export type ProblemData = {
  id: string;
  submittable: boolean;
  url: string;
  source: string;
  title: string;
  input: string;
  output: string;
  samples: Sample[];
};

export interface Sample {
  input: string;
  output: string;
}
