

export interface VectorNode {
  noteId: string
  text: string
  embedding: number[]
}

let store: VectorNode[] = []


export const updateNoteEmbeddings = (noteId: string, nodes: VectorNode[]) => {

  store = [...store.filter(n => n.noteId !== noteId), ...nodes]
}


export const cosineSimilarity = (v1: number[], v2: number[]) => {
  if (v1.length !== v2.length) return 0
  
  let dotProduct = 0
  let normA = 0
  let normB = 0
  for (let i = 0; i < v1.length; i++) {
    dotProduct += v1[i] * v2[i]
    normA += v1[i] * v1[i]
    normB += v2[i] * v2[i]
  }
  
  if (normA === 0 || normB === 0) return 0
  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB))
}


export const searchSimilarChunks = (queryEmbedding: number[], topK = 5) => {
  return store
    .map(node => ({ 
      ...node, 
      score: cosineSimilarity(queryEmbedding, node.embedding) 
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, topK)
}


export const getStore = () => store

