/* global it, expect */

import { transformAsync } from '@babel/core';
import plugin from '../src';
import {
  DISALLOWED_NAN_ERROR_MESSAGE,
  DISALLOWED_INFINITY_ERROR_MESSAGE,
  NON_NUMERIC_EXPRESSION_ERROR_MESSAGE,
} from '../src/const-object';

const options = {
  plugins: [[plugin, { transform: 'constObject' }]],
};

it('Transforms no initializers', async () => {
  const input = `const enum Direction { Left, Right, Down, Up }
`;

  const { code: output } = await transformAsync(input, options);
  expect(output).toMatchSnapshot();

  const Direction = new Function(
    `${output}
return Direction;
`,
  )();
  expect(Direction.Left).toBe(0);
  expect(Direction.Right).toBe(1);
  expect(Direction.Down).toBe(2);
  expect(Direction.Up).toBe(3);
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

  const MyEnum = new Function(
    `${output}
return MyEnum;
`,
  )();
  expect(MyEnum.A).toBe(1);
  expect(MyEnum.B).toBe(1);
  expect(MyEnum.C).toBe('');
  expect(MyEnum.D).toBe('');
  expect(MyEnum.E).toBe(1);
  expect(MyEnum.F).toBe(2);
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

  const MyEnum = new Function(
    `${output}
return MyEnum;
`,
  )();
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

it('Transforms computed members with supported operators', async () => {
  const input = `const enum MyEnum {
  A = -13 + +12 - ~11 / 10 % 9 * 8 ** 7 & 6 | 5 >> 4 >>> 3 << 2 ^ 1,
  B = -(13 + +12 - ~11 / 10) % (9 * 8) ** 7 & 6 | 5 >> 4 >>> 3 << 2 ^ 1,
}
`;

  const { code: output } = await transformAsync(input, options);
  expect(output).toMatchSnapshot();

  const MyEnum = new Function(
    `${output}
return MyEnum;
`,
  )();
  expect(MyEnum.A).toBe(5);
  expect(MyEnum.B).toBe(7);
});

it('Transform fails for unsupported operators', async () => {
  let input;

  input = `const enum MyEnum {
  A = 1 === 1,
}
`;
  await expect(transformAsync(input, options)).rejects.toThrow(
    NON_NUMERIC_EXPRESSION_ERROR_MESSAGE,
  );

  input = `const enum MyEnum {
  A = 1 + (1 > 1),
}
`;
  await expect(transformAsync(input, options)).rejects.toThrow(
    NON_NUMERIC_EXPRESSION_ERROR_MESSAGE,
  );
});

it('Transform fails for `NaN` and `Infinity` computed members', async () => {
  let input;

  input = `const enum MyEnum {
  A = NaN,
}
`;
  await expect(transformAsync(input, options)).rejects.toThrow(
    DISALLOWED_NAN_ERROR_MESSAGE,
  );

  input = `const enum MyEnum {
  A = Infinity,
}
`;
  await expect(transformAsync(input, options)).rejects.toThrow(
    DISALLOWED_INFINITY_ERROR_MESSAGE,
  );

  input = `const enum MyEnum {
  A = 0 / 0,
}
`;
  await expect(transformAsync(input, options)).rejects.toThrow(
    DISALLOWED_NAN_ERROR_MESSAGE,
  );

  input = `const enum MyEnum {
  A = 1 / 0,
}
`;
  expect(transformAsync(input, options)).rejects.toThrow(
    DISALLOWED_INFINITY_ERROR_MESSAGE,
  );
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

  const MyEnum = new Function(
    `${output}
return MyEnum;
`,
  )();
  expect(MyEnum.A).toBe(1);
  expect(MyEnum.B).toBe(2);
  expect(MyEnum.C).toBe(3);
  expect(MyEnum.D).toBe(3);
  expect(MyEnum.E).toBe(9);
  expect(MyEnum.F).toBe(10);
  expect(MyEnum.G).toBe(90);
  expect(MyEnum.H).toBe(91);
  expect(MyEnum.I).toBe(95420416);
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

  const MyEnum = new Function(
    `${output}
return MyEnum;
`,
  )();
  expect(MyEnum.A).toBe(1);
  expect(MyEnum.B).toBe(2);
  expect(MyEnum['C D']).toBe(3);
  expect(MyEnum['E F']).toBe(4);
});

it('Transforms `declare const enum`', async () => {
  const input = `declare const enum MyEnum {
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

  const MyEnum = new Function(
    `${output}
return MyEnum;
`,
  )();
  expect(MyEnum.A).toBe(1);
  expect(MyEnum.B).toBe(1);
  expect(MyEnum.C).toBe('');
  expect(MyEnum.D).toBe('');
  expect(MyEnum.E).toBe(1);
  expect(MyEnum.F).toBe(2);
});

const typescriptOptions = {
  plugins: [...options.plugins, '@babel/transform-typescript'],
};

it('Transforms `export default` with `@babel/plugin-transform-typescript`', async () => {
  const input = `const enum Direction { Left, Right, Down, Up }
export default Direction;
`;

  const { code: output } = await transformAsync(input, typescriptOptions);
  expect(output).toMatchSnapshot();
});

it('Transforms `export` with `@babel/plugin-transform-typescript`', async () => {
  const input = `const enum Direction { Left, Right, Down, Up }
export { Direction };
`;

  const { code: output } = await transformAsync(input, typescriptOptions);
  expect(output).toMatchSnapshot();
});

it('Transforms `export const` with `@babel/plugin-transform-typescript`', async () => {
  const input = `export const enum Direction { Left, Right, Down, Up }
`;

  const { code: output } = await transformAsync(input, typescriptOptions);
  expect(output).toMatchSnapshot();
});
