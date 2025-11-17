import os
import sys
from google import genai
from dotenv import load_dotenv

# Load environment variables
load_dotenv(os.path.join(os.path.dirname(__file__), '..', '.env'))

GEMINI_API_KEY = os.getenv('GEMINI_API_KEY')
client = genai.Client(api_key=GEMINI_API_KEY)

def list_stores():
    """List all stores"""
    stores = client.file_search_stores.list()
    store_list = list(stores)

    if not store_list:
        print("No stores found.")
        return []

    print(f"\nFound {len(store_list)} store(s):\n")
    for idx, store in enumerate(store_list, 1):
        print(f"{idx}. {store.name}")
        print(f"   Display Name: {store.display_name if hasattr(store, 'display_name') else 'N/A'}")
        print(f"   Created: {store.create_time if hasattr(store, 'create_time') else 'N/A'}\n")

    return store_list

def delete_store(store_name):
    """Delete a specific store"""
    try:
        client.file_search_stores.delete(name=store_name)
        print(f"✅ Successfully deleted: {store_name}")
        return True
    except Exception as e:
        print(f"❌ Error deleting {store_name}: {e}")
        return False

def delete_all_stores():
    """Delete all stores"""
    stores = list_stores()
    if not stores:
        return

    confirm = input("\n⚠️  Delete ALL stores? This cannot be undone! (yes/no): ")
    if confirm.lower() != 'yes':
        print("Cancelled.")
        return

    deleted = 0
    for store in stores:
        if delete_store(store.name):
            deleted += 1

    print(f"\n✅ Deleted {deleted}/{len(stores)} stores.")

if __name__ == "__main__":
    print("File Search Store Manager")
    print("=" * 60)

    if len(sys.argv) > 1:
        if sys.argv[1] == "delete-all":
            delete_all_stores()
        elif sys.argv[1] == "list":
            list_stores()
        else:
            # Delete specific store by ID
            delete_store(sys.argv[1])
    else:
        list_stores()
        print("\nUsage:")
        print("  python delete_store.py list                    # List all stores")
        print("  python delete_store.py delete-all              # Delete all stores")
        print("  python delete_store.py [store_id]              # Delete specific store")
