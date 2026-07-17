import { GoogleGenAI, Type } from "@google/genai";
import { Product } from '../types';

export interface ExtractedItem {
    itemName: string; // This should be the *exact* name from the provided product list
    quantity: number;
}

const extractRequisitionItemsFromImage = async (imageBase64: string, mimeType: string, availableProducts: Product[]): Promise<ExtractedItem[]> => {
    // The API key must be obtained exclusively from the environment variable process.env.API_KEY.
    if (!process.env.API_KEY) {
      throw new Error("API_KEY is not defined in the environment.");
    }

    // Always use new GoogleGenAI class instead of deprecated GoogleGenerativeAI
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

    try {
        const productNames = availableProducts.map(p => p.name);
        const promptText = `Analyze the provided image of a handwritten Thai medical order form ('ใบสั่งแพทย์').
Your task is to identify all orders that have been checked with an 'x' or a checkmark.
For each checked order, find the closest matching product name from the provided product list. The matching should be fuzzy to account for abbreviations or slight variations.
Then, extract the numerical quantity associated with that order.

Rules for extraction:
1.  **Item Name:** The \`itemName\` in your response MUST be one of the exact strings from this list: ${JSON.stringify(productNames)}. Do not return any other name.
2.  **Quantity:**
    - For medications, the quantity is the dose number (e.g., 'Ceftriaxone 2 gm' -> quantity: 2).
    - For IV fluids, it might be the rate (e.g., 'IV rate 80 ml/h' -> quantity: 80).
    - If an item is just checked with no number (like a lab test 'CBC' or procedure 'Set OR'), the quantity is 1.
3.  **Output:** Return only the items that were checked on the form and successfully matched to a product from the list. If you cannot find a reasonable match for a checked item, omit it from the response.`;
        
        // Use the new generateContent API with a specific Gemini model
        const response = await ai.models.generateContent({
            model: "gemini-3-flash-preview", // Guideline: gemini-3-flash-preview for simple text/image analysis
            // FIX: Wrapped inlineData and text parts into a single content object with a 'parts' property as required by the GenerateContentParameters and guideline examples.
            contents: {
                parts: [
                    {
                        inlineData: {
                            mimeType: mimeType,
                            data: imageBase64,
                        },
                    },
                    { text: promptText },
                ],
            },
            config: {
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.OBJECT,
                    properties: {
                        items: {
                            type: Type.ARRAY,
                            items: {
                                type: Type.OBJECT,
                                properties: {
                                    itemName: {
                                        type: Type.STRING,
                                        description: "The exact product name from the provided list that best matches the checked item on the form.",
                                    },
                                    quantity: {
                                        type: Type.NUMBER,
                                        description: "The numeric quantity requested for the item.",
                                    },
                                },
                                required: ['itemName', 'quantity'],
                            },
                        },
                    },
                    required: ['items'],
                },
            },
        });
        
        // Use the .text property to get the generated content
        const jsonString = response.text?.trim();
        if (!jsonString) {
            return [];
        }
        const parsed = JSON.parse(jsonString);

        if (parsed && Array.isArray(parsed.items)) {
            const validProductNames = new Set(productNames);
            return parsed.items.filter(
                (item: any): item is ExtractedItem =>
                    typeof item.itemName === 'string' &&
                    validProductNames.has(item.itemName) &&
                    typeof item.quantity === 'number'
            );
        }

        return [];

    } catch (error) {
        console.error("Gemini API call failed:", error);
        throw new Error("Failed to analyze document with AI. Please check the image or try again.");
    }
};

export const geminiService = {
    extractRequisitionItemsFromImage,
};