import java.util.*;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;

/**
 * Multi-Confluence Trading Strategy
 * Traduzione da Pine Script della strategia 4H | Strategia Multi-Confluenza
 */
public class MultiConfluenceStrategy {
    
    // ========== CONFIGURAZIONI ==========
    
    // Impostazioni Regressione Lineare
    private int lengthInput = 100;
    private double linregSensitivity = 0.8;
    private double minPearsonForLinreg = 0.2;
    private double minPearson = 0.5;
    
    // Impostazioni Canale
    private boolean useUpperDevInput = true;
    private double upperMultInput = 1.0;
    private boolean useLowerDevInput = true;
    private double lowerMultInput = 1.0;
    
    // Impostazioni Filtri Segnale
    private boolean useBbFilter = true;
    private boolean usePivotFilter = true;
    private boolean useStochRsiFilter = true;
    private boolean useMaCrossFilter = true;
    private boolean useMomentumFilter = true;
    private boolean usePriceActionFilter = true;
    private boolean useMacdFilter = true;
    
    // Impostazioni Stochastic RSI
    private int stochRsiLength = 14;
    private int stochRsiRsiLength = 14;
    private int stochRsiK = 1;
    private int stochRsiD = 2;
    private double stochOversold = 20;
    private double stochOverbought = 80;
    
    // Impostazioni Medie Mobili
    private int emaLength = 21;
    private int smaLength = 50;
    private int rsiMomentumLength = 14;
    private int volumeAvgLength = 20;
    
    // Impostazioni Momentum
    private int momentumLength = 10;
    private int rocLength = 12;
    private int williamsRLength = 14;
    private int cciLength = 20;
    
    // Impostazioni MACD
    private int macdFastLength = 12;
    private int macdSlowLength = 26;
    private int macdSignalLength = 9;
    
    // Impostazioni Price Action
    private int atrLength = 14;
    private int engulfingLookback = 2;
    private double dojiThreshold = 0.1;
    
    // Impostazioni Bande di Bollinger
    private int bbLength = 20;
    private String bbMaType = "SMA";
    private double bbMult = 2.0;
    
    // Impostazioni Pivot
    private int pivotLength = 9;
    
    // Timer
    private int timerLength = 6;
    
    // ========== VARIABILI DI STATO ==========
    private List<Double> prices = new ArrayList<>();
    private List<Double> highs = new ArrayList<>();
    private List<Double> lows = new ArrayList<>();
    private List<Double> opens = new ArrayList<>();
    private List<Double> volumes = new ArrayList<>();
    
    private double confluenceScore = 0.0;
    private Double recentPh = null;
    private Double recentPl = null;
    private Integer recentPhBar = null;
    private Integer recentPlBar = null;
    
    // ========== CLASSE PER RISULTATI CALCOLO ==========
    public static class CalculationResult {
        public double linregPosition;
        public double pearsonR;
        public double confluenceScore;
        public boolean buySignal;
        public boolean sellSignal;
        public double signalStrength;
        public boolean baseConditionsBuy;
        public boolean baseConditionsSell;
        public String lastSignalTime;
        public double bbPosition;
        public double stochK;
        public double stochD;
        public boolean trendBullish;
        public boolean trendBearish;
        public boolean momentumBullish;
        public boolean momentumBearish;
        public boolean macdBullish;
        public boolean macdBearish;
        public boolean priceActionBullish;
        public boolean priceActionBearish;
    }
    
    // ========== METODI UTILITÀ MATEMATICA ==========
    
    /**
     * Calcola la media semplice
     */
    private double sma(List<Double> values, int period) {
        if (values.size() < period) return 0;
        return values.subList(values.size() - period, values.size())
                    .stream().mapToDouble(Double::doubleValue).average().orElse(0);
    }
    
    /**
     * Calcola la media mobile esponenziale
     */
    private double ema(List<Double> values, int period) {
        if (values.size() < period) return 0;
        
        double multiplier = 2.0 / (period + 1);
        double ema = values.get(values.size() - period);
        
        for (int i = values.size() - period + 1; i < values.size(); i++) {
            ema = (values.get(i) * multiplier) + (ema * (1 - multiplier));
        }
        return ema;
    }
    
    /**
     * Calcola la deviazione standard
     */
    private double stdev(List<Double> values, int period) {
        if (values.size() < period) return 0;
        
        List<Double> subset = values.subList(values.size() - period, values.size());
        double mean = subset.stream().mapToDouble(Double::doubleValue).average().orElse(0);
        double variance = subset.stream()
                               .mapToDouble(x -> Math.pow(x - mean, 2))
                               .average().orElse(0);
        return Math.sqrt(variance);
    }
    
    /**
     * Trova il valore massimo in un periodo
     */
    private double highest(List<Double> values, int period) {
        if (values.size() < period) return 0;
        return values.subList(values.size() - period, values.size())
                    .stream().mapToDouble(Double::doubleValue).max().orElse(0);
    }
    
    /**
     * Trova il valore minimo in un periodo
     */
    private double lowest(List<Double> values, int period) {
        if (values.size() < period) return 0;
        return values.subList(values.size() - period, values.size())
                    .stream().mapToDouble(Double::doubleValue).min().orElse(0);
    }
    
    /**
     * Calcola RSI
     */
    private double rsi(List<Double> values, int period) {
        if (values.size() < period + 1) return 50;
        
        double avgGain = 0;
        double avgLoss = 0;
        
        // Primo calcolo
        for (int i = values.size() - period; i < values.size(); i++) {
            double change = values.get(i) - values.get(i-1);
            if (change > 0) {
                avgGain += change;
            } else {
                avgLoss += Math.abs(change);
            }
        }
        
        avgGain /= period;
        avgLoss /= period;
        
        if (avgLoss == 0) return 100;
        double rs = avgGain / avgLoss;
        return 100 - (100 / (1 + rs));
    }
    
    // ========== CALCOLI REGRESSIONE LINEARE ==========
    
    /**
     * Calcola slope, average e intercept per la regressione lineare
     */
    private double[] calcSlope(List<Double> source, int length) {
        if (source.size() < length) return new double[]{0, 0, 0};
        
        double sumX = 0.0;
        double sumY = 0.0;
        double sumXSqr = 0.0;
        double sumXY = 0.0;
        
        for (int i = 0; i < length; i++) {
            double val = source.get(source.size() - 1 - i);
            double per = i + 1.0;
            sumX += per;
            sumY += val;
            sumXSqr += per * per;
            sumXY += val * per;
        }
        
        double slope = (length * sumXY - sumX * sumY) / (length * sumXSqr - sumX * sumX);
        double average = sumY / length;
        double intercept = average - slope * sumX / length + slope;
        
        return new double[]{slope, average, intercept};
    }
    
    /**
     * Calcola deviazione e correlazione di Pearson
     */
    private double[] calcDev(List<Double> source, int length, double slope, double average, double intercept) {
        if (source.size() < length) return new double[]{0, 0, 0, 0};
        
        double upDev = 0.0;
        double dnDev = 0.0;
        double stdDevAcc = 0.0;
        double dsxx = 0.0;
        double dsyy = 0.0;
        double dsxy = 0.0;
        int periods = length - 1;
        double daY = intercept + slope * periods / 2.0;
        double val = intercept;
        
        for (int j = 0; j < periods; j++) {
            double highPrice = highs.get(highs.size() - 1 - j) - val;
            if (highPrice > upDev) {
                upDev = highPrice;
            }
            
            double lowPrice = val - lows.get(lows.size() - 1 - j);
            if (lowPrice > dnDev) {
                dnDev = lowPrice;
            }
            
            double price = source.get(source.size() - 1 - j);
            double dxt = price - average;
            double dyt = val - daY;
            double priceDiff = price - val;
            stdDevAcc += priceDiff * priceDiff;
            dsxx += dxt * dxt;
            dsyy += dyt * dyt;
            dsxy += dxt * dyt;
            val += slope;
        }
        
        double stdDev = Math.sqrt(stdDevAcc / (periods == 0 ? 1 : periods));
        double pearsonR = (dsxx == 0 || dsyy == 0) ? 0 : dsxy / Math.sqrt(dsxx * dsyy);
        
        return new double[]{stdDev, pearsonR, upDev, dnDev};
    }
    
    // ========== CALCOLI INDICATORI TECNICI ==========
    
    /**
     * Calcola Stochastic RSI
     */
    private double[] calcStochRsi() {
        if (prices.size() < Math.max(stochRsiRsiLength, stochRsiLength)) {
            return new double[]{50, 50};
        }
        
        // Calcola RSI
        List<Double> rsiValues = new ArrayList<>();
        for (int i = stochRsiRsiLength; i < prices.size(); i++) {
            List<Double> subset = prices.subList(i - stochRsiRsiLength, i + 1);
            rsiValues.add(rsi(subset, stochRsiRsiLength));
        }
        
        if (rsiValues.size() < stochRsiLength) {
            return new double[]{50, 50};
        }
        
        // Calcola Stochastic su RSI
        double highestRsi = highest(rsiValues, stochRsiLength);
        double lowestRsi = lowest(rsiValues, stochRsiLength);
        double currentRsi = rsiValues.get(rsiValues.size() - 1);
        
        double stochRsi = (highestRsi != lowestRsi) ? 
            100 * (currentRsi - lowestRsi) / (highestRsi - lowestRsi) : 50;
        
        // Smoothing %K e %D (semplificato)
        double stochK = stochRsi; // In realtà dovrebbe essere smoothed
        double stochD = stochK;   // In realtà dovrebbe essere smoothed
        
        return new double[]{stochK, stochD};
    }
    
    /**
     * Calcola MACD
     */
    private double[] calcMacd() {
        if (prices.size() < macdSlowLength) {
            return new double[]{0, 0, 0};
        }
        
        double emaFast = ema(prices, macdFastLength);
        double emaSlow = ema(prices, macdSlowLength);
        double macdLine = emaFast - emaSlow;
        
        // Semplificazione: signal line come EMA del MACD
        double signalLine = macdLine; // Dovrebbe essere EMA del MACD
        double histogram = macdLine - signalLine;
        
        return new double[]{macdLine, signalLine, histogram};
    }
    
    /**
     * Verifica condizioni base per buy/sell
     */
    private boolean checkBaseConditions(boolean isBuyDirection, CalculationResult result) {
        // Condizione 1: LinReg in zona critica
        boolean linregInZone = isBuyDirection ? 
            result.linregPosition <= -0.7 : result.linregPosition >= 0.7;
        
        // Condizione 2: Pearson R valido
        boolean pearsonValid = Math.abs(result.pearsonR) >= minPearson;
        
        // Condizione 3: Almeno 2 indicatori secondari favorevoli
        int favorableCount = 0;
        
        if (isBuyDirection) {
            // Per segnali di acquisto
            if (result.bbPosition <= -0.5) favorableCount++;
            if (result.stochK <= 30) favorableCount++;
            if (result.trendBullish || (!result.trendBearish && rsi(prices, rsiMomentumLength) > 45)) favorableCount++;
            if (result.momentumBullish) favorableCount++;
            if (result.priceActionBullish || (!result.priceActionBearish)) favorableCount++;
            if (recentPl != null && Math.abs(getCurrentPrice() - recentPl) / recentPl * 100 < 5) favorableCount++;
            if (result.macdBullish) favorableCount++;
        } else {
            // Per segnali di vendita
            if (result.bbPosition >= 0.5) favorableCount++;
            if (result.stochK >= 70) favorableCount++;
            if (result.trendBearish || (!result.trendBullish && rsi(prices, rsiMomentumLength) < 55)) favorableCount++;
            if (result.momentumBearish) favorableCount++;
            if (result.priceActionBearish || (!result.priceActionBullish)) favorableCount++;
            if (recentPh != null && Math.abs(getCurrentPrice() - recentPh) / recentPh * 100 < 5) favorableCount++;
            if (result.macdBearish) favorableCount++;
        }
        
        return linregInZone && pearsonValid && favorableCount >= 2;
    }
    
    // ========== METODO PRINCIPALE DI CALCOLO ==========
    
    /**
     * Esegue tutti i calcoli e restituisce i risultati
     */
    public CalculationResult calculate() {
        CalculationResult result = new CalculationResult();
        
        if (prices.size() < lengthInput) {
            return result; // Dati insufficienti
        }
        
        double currentPrice = getCurrentPrice();
        
        // 1. Calcolo Regressione Lineare
        double[] slopeData = calcSlope(prices, lengthInput);
        double slope = slopeData[0];
        double average = slopeData[1];
        double intercept = slopeData[2];
        
        double endPrice = intercept;
        
        double[] devData = calcDev(prices, lengthInput, slope, average, intercept);
        double stdDev = devData[0];
        result.pearsonR = devData[1];
        
        // Posizione LinReg normalizzata
        result.linregPosition = (stdDev > 0) ? 
            Math.max(-1, Math.min(1, (currentPrice - endPrice) / (stdDev * lowerMultInput))) : 0;
        
        // 2. Calcolo Bande di Bollinger
        double bbBasis = sma(prices, bbLength);
        double bbDev = bbMult * stdev(prices, bbLength);
        double bbUpper = bbBasis + bbDev;
        double bbLower = bbBasis - bbDev;
        result.bbPosition = (currentPrice - bbLower) / (bbUpper - bbLower) * 2 - 1;
        
        // 3. Calcolo Stochastic RSI
        double[] stochData = calcStochRsi();
        result.stochK = stochData[0];
        result.stochD = stochData[1];
        
        // 4. Calcolo Trend (Medie Mobili)
        double ema21 = ema(prices, emaLength);
        double sma50 = sma(prices, smaLength);
        result.trendBullish = ema21 > sma50 && currentPrice > ema21;
        result.trendBearish = ema21 < sma50 && currentPrice < ema21;
        
        // 5. Calcolo Momentum (semplificato)
        if (prices.size() >= momentumLength + 1) {
            double momentum = currentPrice - prices.get(prices.size() - momentumLength - 1);
            double momentumNormalized = momentum / currentPrice * 100;
            result.momentumBullish = momentumNormalized > 0;
            result.momentumBearish = momentumNormalized < 0;
        }
        
        // 6. Calcolo MACD
        double[] macdData = calcMacd();
        double macdLine = macdData[0];
        double signalLine = macdData[1];
        double histogram = macdData[2];
        result.macdBullish = macdLine > signalLine && histogram > 0;
        result.macdBearish = macdLine < signalLine && histogram < 0;
        
        // 7. Price Action (semplificato)
        if (prices.size() >= 2 && opens.size() >= 2) {
            double currentOpen = opens.get(opens.size() - 1);
            double prevClose = prices.get(prices.size() - 2);
            double prevOpen = opens.get(opens.size() - 2);
            
            // Engulfing patterns (semplificato)
            result.priceActionBullish = currentPrice > currentOpen && 
                                       prevClose < prevOpen && 
                                       currentPrice > prevOpen;
            result.priceActionBearish = currentPrice < currentOpen && 
                                       prevClose > prevOpen && 
                                       currentPrice < prevOpen;
        }
        
        // 8. Calcolo Confluence Score
        result.confluenceScore = 0.0;
        
        if (useBbFilter) {
            if (result.bbPosition <= -0.7) result.confluenceScore += 1;
            else if (result.bbPosition >= 0.7) result.confluenceScore -= 1;
        }
        
        if (useStochRsiFilter) {
            if (result.stochK <= stochOversold && result.stochD <= stochOversold) 
                result.confluenceScore += 1;
            else if (result.stochK >= stochOverbought && result.stochD >= stochOverbought) 
                result.confluenceScore -= 1;
        }
        
        if (useMaCrossFilter) {
            if (result.trendBullish) result.confluenceScore += 0.5;
            else if (result.trendBearish) result.confluenceScore -= 0.5;
        }
        
        if (useMomentumFilter) {
            if (result.momentumBullish) result.confluenceScore += 1;
            else if (result.momentumBearish) result.confluenceScore -= 1;
        }
        
        if (usePriceActionFilter) {
            if (result.priceActionBullish) result.confluenceScore += 1;
            else if (result.priceActionBearish) result.confluenceScore -= 1;
        }
        
        if (useMacdFilter) {
            if (result.macdBullish) result.confluenceScore += 1;
            else if (result.macdBearish) result.confluenceScore -= 1;
        }
        
        // 9. Segnali finali
        boolean linregBuyPrimary = result.linregPosition <= -linregSensitivity;
        boolean linregSellPrimary = result.linregPosition >= linregSensitivity;
        boolean pearsonOk = Math.abs(result.pearsonR) >= minPearson;
        
        result.buySignal = linregBuyPrimary && result.confluenceScore >= 0.5 && pearsonOk;
        result.sellSignal = linregSellPrimary && result.confluenceScore <= -0.5 && pearsonOk;
        
        // 10. Verifica condizioni base
        result.baseConditionsBuy = checkBaseConditions(true, result);
        result.baseConditionsSell = checkBaseConditions(false, result);
        
        // 11. Signal Strength
        result.signalStrength = result.confluenceScore + 
                              (linregBuyPrimary ? 1 : linregSellPrimary ? -1 : 0);
        
        // 12. Last Signal Time (semplificato)
        result.lastSignalTime = LocalDateTime.now().format(DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm"));
        
        return result;
    }
    
    // ========== METODI PUBBLICI PER GESTIONE DATI ==========
    
    /**
     * Aggiunge un nuovo tick di prezzo
     */
    public void addTick(double open, double high, double low, double close, double volume) {
        opens.add(open);
        highs.add(high);
        lows.add(low);
        prices.add(close);
        volumes.add(volume);
        
        // Mantieni solo gli ultimi dati necessari per i calcoli
        int maxSize = Math.max(lengthInput, Math.max(bbLength, macdSlowLength)) + 50;
        if (prices.size() > maxSize) {
            opens.remove(0);
            highs.remove(0);
            lows.remove(0);
            prices.remove(0);
            volumes.remove(0);
        }
    }
    
    /**
     * Ottiene il prezzo corrente
     */
    public double getCurrentPrice() {
        return prices.isEmpty() ? 0 : prices.get(prices.size() - 1);
    }
    
    // ========== GETTERS E SETTERS PER CONFIGURAZIONE ==========
    
    public void setLinregSensitivity(double sensitivity) {
        this.linregSensitivity = sensitivity;
    }
    
    public void setMinPearson(double minPearson) {
        this.minPearson = minPearson;
    }
    
    public void setBbLength(int bbLength) {
        this.bbLength = bbLength;
    }
    
    public void setEmaLength(int emaLength) {
        this.emaLength = emaLength;
    }
    
    public void setSmaLength(int smaLength) {
        this.smaLength = smaLength;
    }
    
    // Aggiunta altri setter per tutti i parametri configurabili...
    
    /**
     * Metodo di esempio per testare la strategia
     */
    public static void main(String[] args) {
        MultiConfluenceStrategy strategy = new MultiConfluenceStrategy();
        
        // Esempio di utilizzo
        strategy.addTick(100.0, 102.0, 99.0, 101.0, 1000);
        strategy.addTick(101.0, 103.0, 100.0, 102.0, 1100);
        // ... aggiungi più dati
        
        CalculationResult result = strategy.calculate();
        
        System.out.println("LinReg Position: " + result.linregPosition);
        System.out.println("Confluence Score: " + result.confluenceScore);
        System.out.println("Buy Signal: " + result.buySignal);
        System.out.println("Sell Signal: " + result.sellSignal);
        System.out.println("Signal Strength: " + result.signalStrength);
    }
}