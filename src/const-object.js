import { types } from '@babel/core';
import generate from '@babel/generator';

const DISALLOWED_NAN_ERROR_MESSAGE =
  "'const' enum member initializer was evaluated to disallowed value 'NaN'.";
const DISALLOWED_INFINITY_ERROR_MESSAGE =
  "'const' enum member initializer was evaluated to a non-finite value.";

export default {
  TSEnumDeclaration(path) {
    if (path.node.const) {
      // `path === constObjectPath` for `replaceWith`.
      const [constObjectPath] = path.replaceWith(
        types.variableDeclaration('const', [
          types.variableDeclarator(
            types.identifier(path.node.id.name),
            types.objectExpression(
              TSEnumMembersToObjectProperties(path.get('members')),
            ),
          ),
        ]),
      );
      path.scope.registerDeclaration(constObjectPath);
    }
  },
};

const TSEnumMembersToObjectProperties = (memberPaths) => {
  const isStringEnum = memberPaths.some((memberPath) =>
    types.isStringLiteral(memberPath.node.initializer),
  );
  const constEnum = {};
  let currentValue = 0;

  return memberPaths.map((tsEnumMemberPath) => {
    const keyNode = computeKeyNodeFromIdPath(tsEnumMemberPath.get('id'));
    const key = getKeyFromKeyNode(keyNode);

    const valueNode = computeValueNodeFromEnumMemberPath(
      tsEnumMemberPath,
      isStringEnum,
      constEnum,
      currentValue,
    );
    const value = getValueFromValueNode(valueNode);

    constEnum[key] = value;

    if (types.isNumericLiteral(valueNode)) {
      currentValue = value + 1;
    } else if (types.isStringLiteral(valueNode)) {
      currentValue = null;
    }

    return types.objectProperty(keyNode, valueNode);
  });
};

const computeKeyNodeFromIdPath = (idPath) => {
  const id = idPath.node;

  let keyNode;

  if (types.isIdentifier(id)) {
    const key = id.name;
    keyNode = types.identifier(key);
  } else if (types.isStringLiteral(id)) {
    const key = id.value;
    keyNode = types.stringLiteral(key);
  } else if (types.isNumericLiteral(id)) {
    throw idPath.buildCodeFrameError(
      'An enum member cannot have a numeric name.',
    );
  } else {
    throw idPath.buildCodeFrameError('Enum member expected.');
  }

  return keyNode;
};

const getKeyFromKeyNode = (keyNode) => {
  let key;

  if (types.isIdentifier(keyNode)) {
    key = keyNode.name;
  } else if (types.isStringLiteral(keyNode)) {
    key = keyNode.value;
  }

  return key;
};

const computeValueNodeFromEnumMemberPath = (
  tsEnumMemberPath,
  isStringEnum,
  constEnum,
  currentValue,
) => {
  const initializerPath = tsEnumMemberPath.get('initializer');
  const initializer = initializerPath.node;

  let value;

  if (initializer) {
    if (
      types.isNumericLiteral(initializer) ||
      types.isStringLiteral(initializer)
    ) {
      value = initializer.value;
    } else if (types.isIdentifier(initializer)) {
      validateIdentifierName(initializerPath);
      value = constEnum[initializer.name];
      validateConstEnumMemberAccess(tsEnumMemberPath, value);
    } else if (
      isNumericUnaryExpression(initializer) ||
      isNumericBinaryExpression(initializer)
    ) {
      if (isStringEnum) {
        throw initializerPath.buildCodeFrameError(
          'Computed values are not permitted in an enum with string valued members.',
        );
      }

      initializerPath.traverse(accessConstEnumMemberVisitor, { constEnum });

      value = new Function(`return ${generate(initializer).code}`)();
    } else {
      throw initializerPath.buildCodeFrameError(
        'const enum member initializers can only contain literal values and other computed enum values.',
      );
    }
  } else {
    if (currentValue === null) {
      throw tsEnumMemberPath.buildCodeFrameError(
        'Enum member must have initializer.',
      );
    }
    value = currentValue;
  }

  let valueNode;

  if (Number.isFinite(value)) {
    valueNode = types.numericLiteral(value);
  } else if (typeof value === 'string') {
    valueNode = types.stringLiteral(value);
  } else if (Number.isNaN(value)) {
    throw tsEnumMemberPath.buildCodeFrameError(DISALLOWED_NAN_ERROR_MESSAGE);
  } else if (value === Infinity || value === -Infinity) {
    throw tsEnumMemberPath.buildCodeFrameError(
      DISALLOWED_INFINITY_ERROR_MESSAGE,
    );
  } else {
    // Should not get here.
    throw new Error('`value` is not a number or string');
  }

  return valueNode;
};

const getValueFromValueNode = (valueNode) => {
  let value;

  if (types.isNumericLiteral(valueNode) || types.isStringLiteral(valueNode)) {
    value = valueNode.value;
  }

  return value;
};

const UNARY_OPERATORS = new Set(['+', '-', '~']);

const BINARY_OPERATORS = new Set([
  '+',
  '-',
  '/',
  '%',
  '*',
  '**',
  '&',
  '|',
  '>>',
  '>>>',
  '<<',
  '^',
]);

const isNumericUnaryExpression = (node) =>
  types.isUnaryExpression(node) && UNARY_OPERATORS.has(node.operator);

const isNumericBinaryExpression = (node) =>
  types.isBinaryExpression(node) && BINARY_OPERATORS.has(node.operator);

const validateIdentifierName = (identifierPath) => {
  switch (identifierPath.node.name) {
    case 'NaN':
      throw identifierPath.buildCodeFrameError(DISALLOWED_NAN_ERROR_MESSAGE);
    case 'Infinity':
      throw identifierPath.buildCodeFrameError(
        DISALLOWED_INFINITY_ERROR_MESSAGE,
      );
  }
};

const validateConstEnumMemberAccess = (path, value) => {
  if (value === undefined) {
    throw path.buildCodeFrameError(
      'Enum initializer identifier must reference a previously defined enum member.',
    );
  }
};

const accessConstEnumMemberVisitor = {
  enter(path) {
    if (types.isIdentifier(path.node)) {
      validateIdentifierName(path);
      const constEnum = this.constEnum;
      const value = constEnum[path.node.name];
      validateConstEnumMemberAccess(path, value);

      path.replaceWith(types.numericLiteral(value));
      path.skip();
    } else if (
      !(
        types.isNumericLiteral(path.node) ||
        isNumericUnaryExpression(path.node) ||
        isNumericBinaryExpression(path.node)
      )
    ) {
      throw path.buildCodeFrameError('Must be numeric expression.');
    }
  },
};
