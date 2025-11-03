import { listUsers } from "@/lib/storage-data";

async function main() {
  try {
    const users = await listUsers();
    console.log("Users:", users);
  } catch (error) {
    console.error("Failed to list users:", error);
  }
}

void main();
