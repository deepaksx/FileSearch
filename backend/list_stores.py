import os
from google import genai
from dotenv import load_dotenv

# Load environment variables
load_dotenv(os.path.join(os.path.dirname(__file__), '..', '.env'))

GEMINI_API_KEY = os.getenv('GEMINI_API_KEY')
client = genai.Client(api_key=GEMINI_API_KEY)

print("Listing all your File Search Stores on Google's servers...\n")

try:
    # List all file search stores
    stores = client.file_search_stores.list()

    if not stores:
        print("No file search stores found.")
    else:
        print(f"Found {len(list(stores))} store(s):\n")
        stores = client.file_search_stores.list()  # Re-fetch since we consumed it

        for store in stores:
            print(f"Store ID: {store.name}")
            print(f"Display Name: {store.display_name if hasattr(store, 'display_name') else 'N/A'}")
            print(f"Create Time: {store.create_time if hasattr(store, 'create_time') else 'N/A'}")
            print(f"Update Time: {store.update_time if hasattr(store, 'update_time') else 'N/A'}")
            print("-" * 60)

except Exception as e:
    print(f"Error: {e}")
