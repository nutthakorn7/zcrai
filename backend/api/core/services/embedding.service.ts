import { GoogleGenerativeAI } from "@google/generative-ai";
import { db } from "../../infra/db";
import { alertEmbeddings, alerts } from "../../infra/db/schema";
import { sql, eq, desc } from "drizzle-orm";

// Initialize Gemini
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');
const model = genAI.getGenerativeModel({ model: "text-embedding-004" });

export class EmbeddingService {

    /**
     * Generate embedding vector for text
     */
    static async embed(text: string): Promise<number[]> {
        if (!text) return [];
        try {
            const result = await model.embedContent(text);
            return result.embedding.values;
        } catch (error) {
            console.error("Embedding generation failed:", error);
            return []; // Fail gracefully or throw?
        }
    }

    /**
     * Store embedding for an alert
     */
    static async store(alertId: string, tenantId: string, content: string) {
        const vector = await this.embed(content);
        if (vector.length === 0) return;

        // Delete existing (Manual Upsert)
        await db.delete(alertEmbeddings).where(eq(alertEmbeddings.alertId, alertId));

        await db.insert(alertEmbeddings).values({
            alertId,
            tenantId,
            content,
            vector
        });
    }

    /**
     * Search for similar alerts
     * Uses pgvector cosine distance operator (<=>)
     */
    static async searchSimilar(tenantId: string, queryText: string, limit: number = 3) {
        const queryVector = await this.embed(queryText);
        if (queryVector.length === 0) return [];

        // Drizzle doesn't have native vector search helper yet, use raw SQL
        // Operator <=> is cosine distance
        const similarity = sql`vector <=> ${JSON.stringify(queryVector)}`;

        const results = await db
            .select({
                id: alertEmbeddings.alertId,
                content: alertEmbeddings.content,
                score: similarity
            })
            .from(alertEmbeddings)
            .where(eq(alertEmbeddings.tenantId, tenantId))
            .orderBy(similarity)
            .limit(limit);

        // Fetch full alert details for context
        const alertIds = results.map(r => r.id);
        
        if (alertIds.length === 0) return [];

        const similarAlerts = await db.query.alerts.findMany({
            where: (alerts, { inArray }) => inArray(alerts.id, alertIds)
        });

        return similarAlerts;
    }
}
