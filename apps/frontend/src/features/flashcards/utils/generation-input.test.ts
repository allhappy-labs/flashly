import { describe, expect, it } from 'vitest';
import { hasGenerationInput } from './generation-input';

describe('generation-input', () => {
    it('returns false when material and instruction are empty', () => {
        expect(hasGenerationInput('   ', '   ')).toBe(false);
    });

    it('returns true when material is provided', () => {
        expect(hasGenerationInput('Study text', '')).toBe(true);
    });

    it('returns true when custom instruction is provided', () => {
        expect(hasGenerationInput('', 'Generate beginner cards')).toBe(true);
    });
});
