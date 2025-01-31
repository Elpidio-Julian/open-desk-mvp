from supabase import create_client
import os
from dotenv import load_dotenv

load_dotenv()

class SupabaseClient:
    def __init__(self):
        self.client = create_client(
            os.getenv("SUPABASE_URL"),
            os.getenv("SUPABASE_KEY")
        )

    def get_client(self):
        return self.client
