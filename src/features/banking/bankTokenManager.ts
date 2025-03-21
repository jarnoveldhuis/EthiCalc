// src/features/banking/bankTokenManager.ts

interface TokenInfo {
    token: string;
    userId: string;
    timestamp: number;
  }
  
  export const bankTokenManager = {
    storeToken(userId: string, token: string): void {
      if (!userId || !token) return;
      
      try {
        const tokenInfo: TokenInfo = {
          token,
          userId,
          timestamp: Date.now()
        };
        
        localStorage.setItem('plaid_access_token_info', JSON.stringify(tokenInfo));
        console.log("🔐 Access token stored successfully");
      } catch (error) {
        console.warn("Could not store access token:", error);
      }
    },
    
    getToken(userId: string): string | null {
      if (!userId) return null;
      
      try {
        const storedData = localStorage.getItem('plaid_access_token_info');
        if (!storedData) return null;
        
        const tokenInfo = JSON.parse(storedData) as TokenInfo;
        
        // Verify token belongs to current user
        if (tokenInfo.userId !== userId) {
          console.warn("Stored token belongs to a different user");
          this.clearToken();
          return null;
        }
        
        // Verify token isn't too old (30 days)
        const thirtyDaysMs = 30 * 24 * 60 * 60 * 1000;
        if (Date.now() - tokenInfo.timestamp > thirtyDaysMs) {
          console.warn("Stored token has expired");
          this.clearToken();
          return null;
        }
        
        return tokenInfo.token;
      } catch (error) {
        console.warn("Error retrieving stored access token:", error);
        return null;
      }
    },
    
    clearToken(): void {
      localStorage.removeItem('plaid_access_token_info');
      // Clear any other related storage
      localStorage.removeItem('plaid_token');
      localStorage.removeItem('plaid_access_token');
      console.log("🧹 Bank tokens cleared");
    }
  };