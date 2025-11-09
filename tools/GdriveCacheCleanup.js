import GoogleDrive from "../src/utils/googleDrive.js";
import { GDRIVE } from "../src/config.js";

const googleDrive = new GoogleDrive();

async function cleanCache(folderId, cacheName) {
    try {
        console.log(`Cleaning ${cacheName} cache...`);
        const concurrencyLimit = 100;
        let totalDeletedCount = 0;
        let filesFetched = true;

        while (filesFetched) {
            const files = await googleDrive.listFiles(folderId);
            filesFetched = files.length > 0;

            if (files.length === 0) {
                if (totalDeletedCount === 0) {
                    console.log(`${cacheName} cache is already empty.`);
                }
                break;
            }

            console.log(`\nFetched ${files.length} files for ${cacheName} cache. Deleting in batches...`);

            const deletePromises = [];
            let batchDeletedCount = 0;

            for (let i = 0; i < files.length; i++) {
                const file = files[i];
                const promise = googleDrive.deleteFile(file.id).then(() => {
                    batchDeletedCount++;
                    totalDeletedCount++;
                    process.stdout.write(`\rProgress: ${batchDeletedCount}/${files.length} files in current batch, Total: ${totalDeletedCount} deleted in ${cacheName} cache.`);
                }).catch(error => {
                    console.error(`\nError deleting ${file.name} (ID: ${file.id}):`, error);
                });
                deletePromises.push(promise);

                if (deletePromises.length >= concurrencyLimit || i === files.length - 1) {
                    await Promise.all(deletePromises);
                    deletePromises.length = 0;
                }
            }
            process.stdout.write('\n');
        }
        console.log(`${cacheName} cache cleanup finished. Total deleted: ${totalDeletedCount} items.`);
    } catch (error) {
        console.error(`Error cleaning ${cacheName} cache:`, error);
    }
}

async function main() {
    console.log("Starting Google Drive cache cleanup...");

    await cleanCache(GDRIVE.CACHED_SPOTIFY, "Spotify");
    await cleanCache(GDRIVE.CACHED_TTML, "Apple Music");
    await cleanCache(GDRIVE.CACHED_MUSIXMATCH, "Musixmatch");

    console.log("Google Drive cache cleanup finished.");
}

main();
