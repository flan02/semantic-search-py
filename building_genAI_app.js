// nodejs - express

// Step 1: Setup & Connect to your mongodb instance
const { MongoClient } = require('mongodb')
require('dotenv').config()
const uri = process.env.MONGODB_CONNECTION_STRING
const hfToken = process.env.HF_TOKEN // issued by huggingface
const embeddingUrl = 'https://api-inference.huggingface.co/pipeline/feature-extraction/sentence-transformers/all-MiniLM-L6-v2'
const client = new MongoClient(uri)


// Step 2: Create Embedding Function
async function generateEmbedding(text){
  try {
    const response = await axios.post(
      embeddingUrl,
      { inputs: text },
      { headers: { Authorization: `Bearer ${hfToken}` } }
    )

    if(response.status !== 200){
      throw new Error(`Request failce with status code ${response.status}: ${response.data}`)
    }

    //console.log(response.data)
    return response.data
  }catch(error){
    console.error(error)
  }
}

// it generates an array of vector embeddings this model has 384 dim
// generateEmbedding("mongodb is awesome") 

async function saveEmbeddings(){
  try {
    await client.connect()
    const db = client.db('sample_mflix')
    const collection = db.collection('movies')
    const docs = await collection
      .find({
        'plot': { '$exists': true }
      })
      .limit(50)
      .toArray()
    //await client.db('admin').command({ ping: 1 })
    //console.log('pinged your deployment. You successfully connected to mongodb')

    // Step 3: Create & Store Embeddings
    for (let doc of docs) {
      doc.plot_embedding_hf = await generateEmbedding(doc.plot) // add this prop to our document
      await collection.replaceOne({'_id': doc._id}, doc)
      console.log(`Updated ${doc._id}`) // show documents updated
    }
  } finally {
    console.log('closing connection...')
    await client.close()
  }
}

saveEmbeddings().catch(console.dir) // Only run one time to save embeddings in our collection

// Step 4: Create vector search index (We can do it inside atlas directly)

// Step 5: Query data
async function queryEmbeddings(query){
  try {
    await client.connect()
    const db = client.db('sample_mflix')
    const collection = db.collection('movies')

    results = await collection.aggregate([
      {
        $vectorSearch: {
          index: 'PlotSemanticSearch', // actual name of the index created using Atlas
          'queryVector': await generateEmbedding(query),
          'path': 'plot_embedding_hf',
          'numCandidates': 100,
          'limit': 4
        }
      }, {
        $project: {
          _id: 0,
          title: 1,
          plot: 1
        }
      }
    ]).toArray()

    console.log(results)
  } finally {
    console.log('Closing connection...')
    await client.close()
  }
}

const query = "imaginary characters from outer space at war" // Our current semantin search to the vectorized database
queryEmbedding(query).catch(console.dir)

