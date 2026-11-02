export const rupees = (n: number) => '₹' + Number(n).toLocaleString('en-IN')

export const camelToKebab = (s: string) => s.replace(/[A-Z]/g, (c) => '-' + c.toLowerCase())
