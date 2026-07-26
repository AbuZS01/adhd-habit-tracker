import { test } from 'node:test';
import assert from 'node:assert/strict';
import { extractFinalTranscript } from '@/lib/speechRecognition';

test('extractFinalTranscript: joins only final results from resultIndex onward', () => {
  const event = {
    resultIndex: 1,
    results: {
      length: 3,
      0: { length: 1, isFinal: true, 0: { transcript: 'ignored earlier result' } },
      1: { length: 1, isFinal: true, 0: { transcript: 'built a lego castle' } },
      2: { length: 1, isFinal: false, 0: { transcript: 'and counted the' } },
    },
  };

  assert.equal(extractFinalTranscript(event), 'built a lego castle');
});

test('extractFinalTranscript: returns empty string when nothing is final yet', () => {
  const event = {
    resultIndex: 0,
    results: {
      length: 1,
      0: { length: 1, isFinal: false, 0: { transcript: 'still speaking' } },
    },
  };

  assert.equal(extractFinalTranscript(event), '');
});
