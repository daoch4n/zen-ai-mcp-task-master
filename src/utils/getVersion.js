import crypto from 'crypto';

/**
 * Generates a random nightly version for Task Master.
 * The format is X.Y.Z-nightly.YYYYMMDDHHMMSS.RANDOM,
 * where X.Y.Z is the base version 1.3.37,
 * YYYYMMDDHHMMSS is the current timestamp,
 * and RANDOM is a random 6-digit number.
 * @returns {string} The generated nightly version string.
 */
export function getTaskMasterVersion() {
    const baseVersion = '1.3.37'; // As specified in the instructions
    const now = new Date();

    // Format YYYYMMDDHHMMSS
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const seconds = String(now.getSeconds()).padStart(2, '0');
    const timestamp = `${year}${month}${day}${hours}${minutes}${seconds}`;

    // Generate a random 6-digit number
    const randomBytes = crypto.randomBytes(3); // 3 bytes = 24 bits, enough for 6 decimal digits (max 999999)
    const randomNumber = parseInt(randomBytes.toString('hex'), 16) % 1000000; // Ensure it's 6 digits
    const randomString = String(randomNumber).padStart(6, '0');

    return `${baseVersion}-nightly.${timestamp}.${randomString}`;
}
