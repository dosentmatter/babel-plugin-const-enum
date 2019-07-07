import { transformAsync } from '@babel/core';
import plugin from '../src';

const options = {
  plugins: [
    [plugin, { transform: 'constObject' }],
  ],
};

it('Transforms no initializers', async () => {
  const input =
`const enum Direction { Left, Right, Down, Up };
`;

  const { code: output } = await transformAsync(input, options);
  expect(output).toMatchSnapshot();
});

it('Transforms string members', async () => {
  const input =
`const enum Enum {
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
  const input =
`const enum MyEnum {
  A = 1,
  B = A,
  C,
  D = C,
  E = 1,
  F,
  G = A * E,
  H = A ** B ** C,
  I = A << 20
}
`;

  const { code: output } = await transformAsync(input, options);
  expect(output).toMatchSnapshot();

  const MyEnum = (new Function(
`${output}
return MyEnum;
`))();
  expect(MyEnum.A).toBe(1);
  expect(MyEnum.B).toBe(1);
  expect(MyEnum.C).toBe(2);
  expect(MyEnum.D).toBe(2);
  expect(MyEnum.E).toBe(1);
  expect(MyEnum.F).toBe(2);
  expect(MyEnum.G).toBe(1);
  expect(MyEnum.H).toBe(1);
  expect(MyEnum.I).toBe(1048576);
});

