import { privateKeyToAccount } from "viem/accounts";

const accountOne = privateKeyToAccount(
  "0x0123456789012345678901234567890123456789012345678901234567890123"
);
const accountTwo = privateKeyToAccount(
  "0x0123456789012345678901234567890123456789012345678901234567890124"
);

console.log(accountOne.address);
console.log(accountTwo.address);
