# Step 1: Connect to your MongoDB instance
import pymongo

client = pymongo.MongoClient("<Your MongoDB URI>")
db = client.sample_mflix
collection = db.movies

# Step 2: Set up the embedding creation function
import requests

hf_token = "<your_huggingface_token>" #  Go to https://huggingface.co/ once in the “Access Tokens” section, create a new token by clicking on “New Token” and give it a “read” right
embedding_url = "https://api-inference.huggingface.co/pipeline/feature-extraction/sentence-transformers/all-MiniLM-L6-v2"

def generate_embedding(text: str) -> list[float]:

	response = requests.post(
		embedding_url,
		headers={"Authorization": f"Bearer {hf_token}"},
		json={"inputs": text})

	if response.status_code != 200:
		raise ValueError(f"Request failed with status code {response.status_code}: {response.text}")

return response.json()

# Now you can test out generating embeddings using the function we defined above
generate_embedding("MongoDB is awesome")

# Total number of dimensions 384
len(generate_embedding("MongoDB is awesome))

# Step 3: Create and store embeddings
for doc in collection.find({'plot':{"$exists": True}}).limit(50):
	doc['plot_embedding_hf'] = generate_embedding(doc['plot'])
	collection.replace_one({'_id': doc['_id']}, doc)

# Step 4: Create a vector search index
"""
This will lead to the “Create a Search Index” configuration page. Select the “JSON Editor” and click “Next.”
Now, perform the following three steps on the "JSON Editor" page:
Select the database and collection on the left. For this tutorial, it should be sample_mflix/movies.
Enter the Index Name. For this tutorial, we are choosing to call it PlotSemanticSearch.
Enter the configuration JSON (given below) into the text editor. The field name should match the name of the embedding field created in Step 3 (for this tutorial it should be plot_embedding_hf), 
and the dimensions match those of the chosen model (for this tutorial it should be 384). The chosen value for the "similarity" field (of “dotProduct”) represents cosine similarity, in our case.
Then, click “Next” and click “Create Search Index” button on the review page.
"""
# {
#   "type": "vectorSearch,
#   "fields": [{
#     "path": "plot_embedding_hf",
#     "dimensions": 384,
#     "similarity": "dotProduct",
#     "type": "vector"
#   }]
# }

# Step 5: Query your data

query = "imaginary characters from outer space at war"

results = collection.aggregate([
  {"$vectorSearch": {
    "queryVector": generate_embedding(query),
    "path": "plot_embedding_hf",
    "numCandidates": 100,
    "limit": 4,
    "index": "PlotSemanticSearch",
      }}
});

for document in results:
    print(f'Movie Name: {document["title"]},\nMovie Plot: {document["plot"]}\n')
                    
