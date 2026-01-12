export const fixTimestamp = (dateString: string | null | undefined): Date => {
    if (!dateString) return new Date();

    // Check if it's already a valid date string that might be interpreted correctly
    // or if it's missing timezone info (common with simple SQL datetime dumps)
    let fixed = dateString;

    // If it looks like ISO format (YYYY-MM-DDTHH:mm:ss...) but misses 'Z' or offset
    if (fixed.includes('T') && !fixed.endsWith('Z') && !fixed.includes('+')) {
        fixed += 'Z';
    }

    const d = new Date(fixed);
    if (isNaN(d.getTime())) {
        return new Date(); // Fallback to now if invalid to prevent crashes
    }
    return d;
};
