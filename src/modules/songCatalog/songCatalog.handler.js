import { SongCatalogService } from "../../shared/services/songCatalog.service.js";

export async function handleSonglistSearch(c) {
    const startTime = Date.now();
    const query = c.req.query();
    const q = query.q;

    if (!q) {
        return c.json({ error: "Missing required parameter: q (query)" }, 400);
    }

    try {
        const results = await SongCatalogService.search(q, c.env);
        return c.json({
            results,
            processingTime: {
                timeElapsed: Date.now() - startTime,
                lastProcessed: Date.now(),
            },
        }, 200);
    } catch (error) {
        console.error("Error handling song catalog search:", error);
        return c.json(
            { error: "Internal Server Error", details: error.message },
            500,
            { "Cache-Control": "no-store" }
        );
    }
}