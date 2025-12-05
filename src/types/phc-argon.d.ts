declare module '@phc/argon2' {
  export interface Argon2Result {
    hash: Uint8Array;
  }

  export interface Argon2Options {
    password: Uint8Array;
    salt: Uint8Array;
    memoryCost: number;
    timeCost: number;
    parallelism: number;
    hashLength: number;
  }

  export function argon2id(options: Argon2Options): Promise<Argon2Result>;
}
