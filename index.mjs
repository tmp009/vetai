import 'dotenv/config';
import inquirer from 'inquirer';
import { OpenAI } from 'openai';
import fs from 'fs/promises';

const openai = new OpenAI();
const vetFilePath = './vet.json'

async function main() {
    const data = JSON.parse(await fs.readFile(vetFilePath))

    await getEmbeddings(data);
    await fs.writeFile(vetFilePath, JSON.stringify(data));

    try {
        while (true) {
            console.log("");

            const input = (await inquirer.prompt([{ type: 'input', name: 'cmd', prefix: '>', message: ' ' }])).cmd.trim();

            await processInput(input, data);
        }
    } catch (error) {
        console.error('An error occurred:', error);
    }
}

async function processInput(input, data) {
    const answers = (await getAnswers(input, data, 5))
                        .map((vetCase) => `Symptoms: ${vetCase.symptoms}\n diagnosis: ${vetCase.diagnosis}\n treatments: ${vetCase.treatments}\n`)
                        .join('\n')

    const stream = await runOpenAI(input, answers);

    for await (const chunk of stream) {
        const delta = (chunk.choices[0]?.delta?.content || "").replace(/\*/g, '')

        process.stdout.write(delta);
    }
}

async function getEmbeddings(data) {
    for (const vetCase of data) {
        if (!vetCase.embedding) {
            const embedding = await openai.embeddings.create({ model: 'text-embedding-3-small', input: vetCase.symptoms });
            vetCase.embedding = embedding.data[0].embedding;
        }
    }
}

function cosineSimilarity(vecA, vecB) {
    let dotProduct = 0.0;
    let normA = 0.0;
    let normB = 0.0;

    for (let i = 0; i < vecA.length; i++) {
      dotProduct += vecA[i] * vecB[i];
      normA += vecA[i] * vecA[i];
      normB += vecB[i] * vecB[i];
    }

    if (normA === 0 || normB === 0) {
      return 0;
    } else {
      return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
    }
}

async function getAnswers(input, data, maxResults=3) {
    const inputEmbedding = (await openai.embeddings.create({ model: 'text-embedding-3-small', input: input })).data[0].embedding;
    const top = data
                .filter((vetCases) => vetCases.embedding ?  cosineSimilarity(vetCases.embedding, inputEmbedding) > 0.2 : false)
                .sort((a, b) => {
                    let similarityA = cosineSimilarity(a.embedding, inputEmbedding);
                    let similarityB = cosineSimilarity(b.embedding, inputEmbedding);
                    return similarityB - similarityA
                })
                .slice(0, maxResults)

    return top
}

async function runOpenAI(input, answers) {
    const stream = await openai.chat.completions.create({
        messages: [
        { role: 'system', content: 'You are a medical assistant bot. You will answer user\'s question only using your Knowledge base and related information. Do not answer math or off-topic questions.' },
        { role: 'system', content: 'Knowledge base: ' + answers },
        { role: 'user', content: input }
    ],
        model: 'gpt-4-turbo-2024-04-09',
        temperature: 0.1,
        stream: true,
    });

    return stream
}

main()