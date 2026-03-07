export function getRandomString(length: number): string {
    return Array.from(
        {
            length: Math.max(1, length / 8)
        },
        (_, _i) => Math.random()
            .toString(36)
            .substring(2, 10)
    )
        .join('')
        .slice(0, length);
}