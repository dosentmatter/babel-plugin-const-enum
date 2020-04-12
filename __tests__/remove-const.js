import { transformAsync } from '@babel/core';
import plugin from '../src';

const options = {
  plugins: [plugin],
};

it('Transforms no initializers', async () => {
  const input = `const enum Direction { Left, Right, Down, Up };
`;

  const { code: output } = await transformAsync(input, options);
  expect(output).toMatchSnapshot();
});

it('Transforms string members', async () => {
  const input = `const enum MyEnum {
  A = 1,
  B = A,
  C = '',
  D = C,
  E = 1,
  F,
}
`;

  const { code: output } = await transformAsync(input, options);
  expect(output).toMatchSnapshot();
});

it('Transforms computed members', async () => {
  const input = `const enum MyEnum {
  A = 1,
  B = A,
  C,
  D = C,
  E = 1,
  F,
  G = A * E,
  H = A ** B ** C,
  I = A << 20,
}
`;

  const { code: output } = await transformAsync(input, options);
  expect(output).toMatchSnapshot();
});

it('Transforms chained computed members', async () => {
  const input = `const enum MyEnum {
  A = 1,
  B = A * 2,
  C,
  D = C,
  E = D ** 2,
  F,
  G = F * E,
  H,
  I = H << 20,
}
`;

  const { code: output } = await transformAsync(input, options);
  expect(output).toMatchSnapshot();
});

it('Transforms string literal properties', async () => {
  const input = `const enum MyEnum {
  'A' = 1,
  "B" = 2,
  'C D' = 3,
  'E F' = 4,
}
`;

  const { code: output } = await transformAsync(input, options);
  expect(output).toMatchSnapshot();
});
