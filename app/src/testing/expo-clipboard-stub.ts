/**
 * Vitest stand-in for `expo-clipboard`. The package's entry imports
 * `expo`, whose async-require setup asks for an HMR module that the
 * test server does not serve. A test that checks a copy mocks this
 * module itself.
 */
export async function setStringAsync(_text: string): Promise<boolean> {
  return true;
}
