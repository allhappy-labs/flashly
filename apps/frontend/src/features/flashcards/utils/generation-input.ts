export function hasGenerationInput(materialText: string, customInstruction: string): boolean {
    return materialText.trim().length > 0 || customInstruction.trim().length > 0;
}
