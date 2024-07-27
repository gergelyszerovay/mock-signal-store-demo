const { getJestProjects } = require('@nx/jest');

console.log(getJestProjects());

export default { projects: getJestProjects() };
