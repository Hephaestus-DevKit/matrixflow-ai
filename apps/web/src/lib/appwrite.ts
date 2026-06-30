import { Client, Account } from 'appwrite';

const client = new Client();

const endpoint = process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT ?? 'https://cloud.appwrite.io/v1';
const projectId = process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID ?? 'your-project-id';

client
    .setEndpoint(endpoint)
    .setProject(projectId);

export const account = new Account(client);
export { client };
