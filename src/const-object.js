import { types } from '@babel/core';
import generate from '@babel/generator';

export default {
  TSEnumDeclaration(path) {
    if (path.node.const) {
      path.replaceWith(
        types.variableDeclaration('const', [
          types.variableDeclarator(
            types.identifier(path.node.id.name),
            types.objectExpression(
              TSEnumMembersToObjectProperties(path.get('members')),
            ),
          ),
        ]),
      );
      path.skip();
    }
  },
};

const TSEnumMembersToObjectProperties = memberPaths => {
  const isStringEnum = memberPaths.some(memberPath =>
    types.isStringLiteral(memberPath.node.initializer),
  );
  const constEnum = {};
  let currentValue = 0;

  return memberPaths.map(tsEnumMemberPath => {
    const tsEnumMember = tsEnumMemberPath.node;

    let value;
    let valueNode;
    if (tsEnumMember.initializer) {
      if (
        types.isNumericLiteral(tsEnumMember.initializer) ||
        types.isStringLiteral(tsEnumMember.initializer)
      ) {
        value = tsEnumMember.initializer.value;
      } else if (types.isIdentifier(tsEnumMember.initializer)) {
        value = constEnum[tsEnumMember.initializer.name];
        validateConstEnumMemberAccess(tsEnumMemberPath, value);
      } else if (
        isNumericUnaryExpression(tsEnumMember.initializer) ||
        isNumericBinaryExpression(tsEnumMember.initializer)
      ) {
        if (isStringEnum) {
          throw tsEnumMemberPath.buildCodeFrameError(
            'Computed values are not permitted in an enum with string valued members.',
          );
        }

        tsEnumMemberPath
          .get('initializer')
          .traverse(accessConstEnumMemberVisitor, { constEnum });
        value = eval(generate(tsEnumMember.initializer).code);
      } else {
        throw tsEnumMemberPath.buildCodeFrameError(
          'Enum initializer must be a string literal or numeric expression.',
        );
      }
    } else {
      if (currentValue === null) {
        throw tsEnumMemberPath.buildCodeFrameError(
          'Enum member must have initializer..',
        );
      }
      value = currentValue;
    }

    constEnum[tsEnumMember.id.name || tsEnumMember.id.value] = value;
    if (Number.isFinite(value)) {
      valueNode = types.numericLiteral(value);
      currentValue = value + 1;
    } else if (typeof value === 'string') {
      valueNode = types.stringLiteral(value);
      currentValue = null;
    } else {
      // Should not get here.
      throw new Error('`value` is not a numer or string');
    }

    return types.objectProperty(
      types.identifier(tsEnumMember.id.name || tsEnumMember.id.value),
      valueNode,
    );
  });
};

const isNumericUnaryExpression = node =>
  types.isUnaryExpression(node) && new Set(['+', '-', '~']).has(node.operator);

const isNumericBinaryExpression = node =>
  types.isBinaryExpression(node) &&
  new Set([
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
  ]).has(node.operator);

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
