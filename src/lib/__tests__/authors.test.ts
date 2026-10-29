/** A name over a line only where the side no longer says who wrote it. */
import { authorHeads } from '../authors';

describe('authorHeads', () => {
  it('names nobody while there is one other voice: the side says who', () => {
    expect(authorHeads(['agent', 'Emirhan', 'agent'], [false, true, false])).toEqual([null, null, null]);
  });

  it('names the first line of each voice when there are two of them', () => {
    // The agent, another person, the agent again.
    expect(authorHeads(['agent', 'Deniz', 'agent', 'Deniz', 'Emirhan'], [false, false, false, false, true])).toEqual([
      'agent',
      'Deniz',
      'agent',
      'Deniz',
      null,
    ]);
  });

  it('says nothing twice: the lines under a name belong to it', () => {
    expect(authorHeads(['agent', 'agent', 'agent', 'Deniz'], [false, false, false, false])).toEqual([
      'agent',
      null,
      null,
      'Deniz',
    ]);
  });

  it('leaves the reader out of it, whatever is around their lines', () => {
    expect(authorHeads(['agent', 'Emirhan', 'Deniz'], [false, true, false])).toEqual(['agent', null, 'Deniz']);
  });

  it('covers a conversation answered by another model', () => {
    // One model is one voice; switching to another makes it two.
    expect(authorHeads(['claude-sonnet-4.5', 'claude-opus'], [false, false])).toEqual([
      'claude-sonnet-4.5',
      'claude-opus',
    ]);
    expect(authorHeads(['claude-opus', 'claude-opus'], [false, false])).toEqual([null, null]);
  });

  it('has nothing to say about a line with no author', () => {
    expect(authorHeads([null, 'agent', null], [false, false, false])).toEqual([null, null, null]);
  });
});
