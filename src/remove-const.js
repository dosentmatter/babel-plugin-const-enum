export default {
  TSEnumDeclaration(path) {
    if (path.node.const) {
      path.node.const = false;
    }
  }
};
