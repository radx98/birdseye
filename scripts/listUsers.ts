import { listVolumeUsers } from "@/lib/modal-data";

async function main() {
  try {
    const users = await listVolumeUsers();
    console.log("Users:", users);
  } catch (error) {
    console.error("Failed to list users:", error);
  }
}

void main();
