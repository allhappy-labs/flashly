import { test } from 'node:test';
import * as assert from 'node:assert';
import { sanitizeEmailHeader, sanitizeEmailSubject } from '../../lib/utils/sanitization.ts';

test('sanitizeEmailHeader removes CRLF and collapses whitespace', () => {
    const result = sanitizeEmailHeader('John\r\n  Doe');
    assert.equal(result, 'John Doe');
    assert.equal(result.includes('\r'), false);
    assert.equal(result.includes('\n'), false);
});

test('sanitizeEmailHeader prevents header injection formatting', () => {
    const result = sanitizeEmailHeader('John\nBcc: victim@example.com');
    assert.equal(result, 'John Bcc: victim@example.com');
});

test('sanitizeEmailHeader handles complex injection attempts', () => {
    const result = sanitizeEmailHeader(
        'John\r\nBcc: victim1@example.com, victim2@example.com\r\nSubject: Spam\r\nCc: victim3@example.com',
    );
    assert.equal(
        result,
        'John Bcc: victim1@example.com, victim2@example.com Subject: Spam Cc: victim3@example.com',
    );
});

test('sanitizeEmailSubject sanitizes newlines and truncates to RFC-safe length', () => {
    const result = sanitizeEmailSubject(`John\nDoe${'A'.repeat(1000)}`);
    assert.equal(result.includes('\n'), false);
    assert.equal(result.length, 998);
});
