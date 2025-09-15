// Secure logging utility for frontend to prevent sensitive data exposure
const sensitiveFields = ['password', 'token', 'secret', 'key', 'auth', 'credential'];

const redactSensitiveData = (obj) => {
  if (typeof obj !== 'object' || obj === null) {
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj.map(item => redactSensitiveData(item));
  }

  const redacted = { ...obj };
  
  Object.keys(redacted).forEach(key => {
    const lowerKey = key.toLowerCase();
    
    // Check if the key contains any sensitive field names
    if (sensitiveFields.some(field => lowerKey.includes(field))) {
      redacted[key] = '[REDACTED]';
    } else if (typeof redacted[key] === 'object') {
      redacted[key] = redactSensitiveData(redacted[key]);
    }
  });

  return redacted;
};

const secureLog = (message, data = null) => {
  if (data) {
    const safeData = redactSensitiveData(data);
    console.log(message, safeData);
  } else {
    console.log(message);
  }
};

export { redactSensitiveData, secureLog };
