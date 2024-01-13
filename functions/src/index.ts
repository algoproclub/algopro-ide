import fetch from "node-fetch";
import * as cheerio from "cheerio";

type Problem = {
  id: string;
  url: string;
  title: string;
  statement: string;
  samples: Sample[];
};

// FIXME: We might need to escape HTML entities (?)
const preToPlaintext = (pre: cheerio.Element) =>
  Array.from(pre.children)
    .map((node) => {
      if (node.type === "tag" && node.tagName === "br") {
        return "\n";
      } else if (node.type === "text") {
        return node.data;
      }
    })
    .join("");

export async function fetchProblemData(
  problemId: string
): Promise<Problem | null> {
  const PROBLEM_REGEX = /(\d+)([A-Za-z]+)/;

  const matches = problemId.match(PROBLEM_REGEX);
  // TODO: Figure out error handling
  if (!matches) return null;

  const url = `https://codeforces.com/problemset/problem/${matches[1]}/${matches[2]}`;
  const response = await fetch(url);
  if (!response) return null;

  const document = cheerio.load(await response.text());

  const samples: Sample[] = [];
  const inputs_and_outputs = Array.from(document(".sample-test pre")).map(
    preToPlaintext
  );
  for (let i = 0; i < inputs_and_outputs.length; i += 2) {
    samples.push({
      input: inputs_and_outputs[i],
      output: inputs_and_outputs[i + 1],
    });
  }

  const statement = document(".problem-statement > :not([class])");
  const input_spec = document(".problem-statement > .input-specification");
  const output_spec = document(".problem-statement > .output-specification");

  return {
    id: problemId,
    url,
    title: document(".header > .title").text(),
    statement: [statement, input_spec, output_spec]
      .map((el) => el.html())
      .join("\n"),
    samples,
  };
}
