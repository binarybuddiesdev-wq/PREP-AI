const parameterList = (code: string) => {
  const match =
    code.match(/function\s+[\w$]*\s*\(([^)]*)\)/) ??
    code.match(/(?:const|let|var)\s+[\w$]+\s*=\s*\(([^)]*)\)\s*=>/) ??
    code.match(/(?:const|let|var)\s+[\w$]+\s*=\s*([\w$]+)\s*=>/) ??
    code.match(/def\s+[\w$]+\s*\(([^)]*)\)/);
  if (!match?.[1]) return [];
  return match[1]
    .split(',')
    .map(
      (parameter) =>
        parameter
          .split(/[:=]/, 1)[0]
          ?.trim()
          .replace(/^\.\.\./, '') ?? ''
    )
    .filter((parameter) => parameter && parameter !== 'self' && parameter !== 'cls');
};

export const getCodingArgumentNames = (problem: {
  codeJs: string;
  codeTs: string;
  codePy: string;
}) => {
  const jsParameters = parameterList(problem.codeJs);
  if (jsParameters.length > 0) return jsParameters;
  const tsParameters = parameterList(problem.codeTs);
  if (tsParameters.length > 0) return tsParameters;
  return parameterList(problem.codePy);
};
