import {getMeANumber} from '/b.js';


console.log(getMeANumber() + 1);


// const SOURCE = `
// let {a = 20;
// `;


// let result = parse(SOURCE, {ecmaVersion: 'latest'});

// console.log(result.body[0].declarations[0].id.properties[0].value);


// let classBody = result.body[0].body.body;

// let csq = classBody.at(-1).value.body.body[0].consequent;

// console.log(csq.expression.callee);
// console.log(SOURCE.slice(csq.start, csq.end));


// for (let classMember of classBody) {
//   console.log("Next method:", SOURCE.slice(classMember.start, classMember.end));
// }
