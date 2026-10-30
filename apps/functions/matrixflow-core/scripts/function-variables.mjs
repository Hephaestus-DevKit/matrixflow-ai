import { Query } from 'node-appwrite';

export async function listAllFunctionVariables(functions, functionId) {
  const variables = [];
  const pageSize = 100;
  let cursor;
  while (true) {
    const page = await functions.listVariables({
      functionId,
      queries: [Query.limit(pageSize), ...(cursor ? [Query.cursorAfter(cursor)] : [])],
    });
    variables.push(...page.variables);
    if (page.variables.length < pageSize) return variables;
    const nextCursor = page.variables.at(-1).$id;
    if (!nextCursor || nextCursor === cursor)
      throw new Error('Function variable pagination did not advance');
    cursor = nextCursor;
  }
}
