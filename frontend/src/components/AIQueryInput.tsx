import { useState } from "react";
import { Input, Button, Card, CardBody } from "@heroui/react";
import { Icon } from "../shared/ui";
import { AIAPI } from "../shared/api/ai";

interface AIQueryInputProps {
    onFiltersApplied: (filters: any) => void;
}

export function AIQueryInput({ onFiltersApplied }: AIQueryInputProps) {
    const [prompt, setPrompt] = useState("");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleAskAI = async () => {
        if (!prompt) return;
        setLoading(true);
        setError(null);
        try {
            const res = await AIAPI.generateQuery(prompt);
            const { filters, explanation } = res.data.data;
            if (explanation) {
                // Show a brief toast or message if needed, for now just apply filters

            }
            onFiltersApplied(filters);
        } catch (e) {
            console.error(e);
            setError("Failed to generate query. Please try again.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <Card className="mb-4 border border-indigo-500/20 bg-indigo-500/5">
            <CardBody className="p-4 flex flex-col gap-3">
                <div className="flex items-center gap-2 mb-1">
                    <div className="p-1.5 bg-indigo-500/10 rounded-lg">
                        <Icon.Cloud className="w-4 h-4 text-indigo-400" />
                    </div>
                    <span className="text-sm font-medium text-indigo-300">AI Assistant</span>
                </div>
                <div className="flex gap-2 w-full">
                    <Input 
                        placeholder="Ask AI: 'Show me failed logins from Russia in the last 24 hours'..." 
                        value={prompt}
                        onValueChange={setPrompt}
                        onKeyDown={(e) => e.key === 'Enter' && handleAskAI()}
                        variant="bordered"
                        className="flex-1"
                        classNames={{
                           inputWrapper: "h-12 bg-background/50 border-white/10 hover:border-indigo-500/50 focus-within:border-indigo-500 transition-colors"
                        }}
                    />
                    <Button 
                        className="h-12 px-6"
                        color="primary" 
                        isLoading={loading}
                        onPress={handleAskAI}
                        startContent={!loading && <Icon.Zap className="w-5 h-5" />}
                    >
                        Generate Filters
                    </Button>
                </div>
            </CardBody>
            {error && <div className="px-4 pb-2 text-red-400 text-xs">{error}</div>}
        </Card>
    );
}
