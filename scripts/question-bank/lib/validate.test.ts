import { validateChunkPlan, validateQuestions } from './validate';

describe('validateChunkPlan', () => {
  const validPlan = {
    sourceDoc: 'DR_2337_Jan2025.pdf',
    chunks: [
      {
        chunkId: 'c1',
        title: 'Right of Way',
        description: 'Right-of-way rules at intersections',
        pageStart: 5,
        pageEnd: 6,
      },
    ],
  };

  it('accepts a valid plan', () => {
    expect(validateChunkPlan(validPlan)).toEqual(validPlan);
  });

  it('rejects a non-object payload', () => {
    expect(() => validateChunkPlan('not an object')).toThrow('must be a JSON object');
  });

  it('rejects an empty chunks array', () => {
    expect(() => validateChunkPlan({ sourceDoc: 'x.pdf', chunks: [] })).toThrow('non-empty array');
  });

  it('rejects a duplicate chunkId', () => {
    const dup = {
      sourceDoc: 'x.pdf',
      chunks: [
        { chunkId: 'c1', title: 'A', description: 'a', pageStart: 1, pageEnd: 2 },
        { chunkId: 'c1', title: 'B', description: 'b', pageStart: 3, pageEnd: 4 },
      ],
    };
    expect(() => validateChunkPlan(dup)).toThrow('Duplicate chunkId "c1"');
  });

  it('rejects an invalid page range', () => {
    const bad = {
      sourceDoc: 'x.pdf',
      chunks: [{ chunkId: 'c1', title: 'A', description: 'a', pageStart: 5, pageEnd: 3 }],
    };
    expect(() => validateChunkPlan(bad)).toThrow('invalid page range');
  });
});

describe('validateQuestions', () => {
  const validQuestion = {
    conceptId: 'concept-1',
    chunkId: 'c1',
    sourceRef: 'p.5',
    type: 'fact',
    text: 'What color is a stop sign?',
    choices: ['Red', 'Yellow', 'Blue'],
    correctAnswer: 'Red',
    selfCheck: { passed: true, notes: '' },
  };

  it('accepts a valid question list', () => {
    expect(validateQuestions([validQuestion])).toEqual([validQuestion]);
  });

  it('rejects an empty array', () => {
    expect(() => validateQuestions([])).toThrow('non-empty array');
  });

  it('rejects an invalid type', () => {
    expect(() => validateQuestions([{ ...validQuestion, type: 'bogus' }])).toThrow('invalid "type"');
  });

  it('rejects a correctAnswer not present in choices', () => {
    expect(() => validateQuestions([{ ...validQuestion, correctAnswer: 'Green' }])).toThrow(
      'not present in its "choices"'
    );
  });

  it('rejects a flagged question with no selfCheck notes', () => {
    expect(() =>
      validateQuestions([{ ...validQuestion, selfCheck: { passed: false, notes: '' } }])
    ).toThrow('no "selfCheck.notes"');
  });
});
