import os
from google import genai
from dotenv import load_dotenv

# Load environment variables
load_dotenv(os.path.join(os.path.dirname(__file__), '..', '.env'))

GEMINI_API_KEY = os.getenv('GEMINI_API_KEY')
client = genai.Client(api_key=GEMINI_API_KEY)

print("Listing available models...")
try:
    models = client.models.list()
    print("\nAvailable models:")
    for model in models:
        print(f"  - {model.name}")
        if hasattr(model, 'supported_generation_methods'):
            print(f"    Supported methods: {model.supported_generation_methods}")
except Exception as e:
    print(f"Error: {e}")
