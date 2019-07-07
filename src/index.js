import { declare } from '@babel/helper-plugin-utils';
import syntaxTypeScript from '@babel/plugin-syntax-typescript';
import { types } from '@babel/core';
import removeConst from './remove-const';
import constObject from './const-object';

export default declare((api, { transform = 'removeConst' }) => {
  api.assertVersion(7);

  let visitor;
  if (transform === 'removeConst') {
    visitor = removeConst;
  } else if (transform=== 'constObject') {
    visitor = constObject;
  } else {
    throw Error('transform option must be removeConst|constObject');
  }

  return {
    name: 'const-enum',
    inherits: syntaxTypeScript,
    visitor,
  };
});
