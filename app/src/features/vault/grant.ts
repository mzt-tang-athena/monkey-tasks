import * as FileSystem from "expo-file-system/legacy";

const { StorageAccessFramework } = FileSystem;

const PERMISSION_FILE = "vault-folder.txt";

export async function getSavedVaultUri(): Promise<string | null> {
  const uri = `${FileSystem.documentDirectory}${PERMISSION_FILE}`;
  const info = await FileSystem.getInfoAsync(uri);
  if (!info.exists) {
    return null;
  }
  const value = await FileSystem.readAsStringAsync(uri);
  return value.trim() === "" ? null : value;
}

async function saveVaultUri(folderUri: string | null): Promise<void> {
  const uri = `${FileSystem.documentDirectory}${PERMISSION_FILE}`;
  await FileSystem.writeAsStringAsync(uri, folderUri ?? "", {
    encoding: FileSystem.EncodingType.UTF8,
  });
}

/** Open the system folder picker and persist the grant. Returns the uri or null. */
export async function requestVaultAccess(): Promise<string | null> {
  const result = await StorageAccessFramework.requestDirectoryPermissionsAsync();
  if (!result.granted) {
    return null;
  }
  await saveVaultUri(result.directoryUri);
  return result.directoryUri;
}
