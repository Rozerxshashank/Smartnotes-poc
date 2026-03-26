import { pipeline, env } from '@huggingface/transformers'

env.allowLocalModels = false
env.allowRemoteModels = true

let embedderPromise: Promise<any> | null = null

export const getEmbedder = () => {
  if (!embedderPromise) {

    embedderPromise = pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2')
  }
  return embedderPromise
}


export const generateEmbedding = async (text: string): Promise<number[]> => {
  try {
    const model = await getEmbedder()
    const output = await model(text, { pooling: 'mean', normalize: true })
    return Array.from(output.data) as number[]
  } catch (error) {
    console.error('Error generating embedding:', error)
    return []
  }
}


export const chunkText = (text: string, chunkSize = 500, overlap = 50): string[] => {
  const chunks: string[] = []
  let index = 0
  
  while (index < text.length) {
    const chunk = text.slice(index, index + chunkSize)
    chunks.push(chunk)
    index += (chunkSize - overlap)
  }
  
  return chunks
}

