declare module "cloudflare:workers" {
  export const env: {
    // The hosted build injects the concrete Cloudflare binding type.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    DB: any;
  };
}
