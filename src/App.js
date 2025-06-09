import React, { useState, useEffect } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  BarChart,
  Bar,
} from "recharts";
import "./App.css";

const EMICalculator = () => {
  // State variables
  const [loanAmount, setLoanAmount] = useState(100000);
  const [interestRate, setInterestRate] = useState(10);
  const [loanPeriod, setLoanPeriod] = useState(12);
  const [monthlyExtraPayment, setMonthlyExtraPayment] = useState(1000);
  const [monthlyExtraPaymentInput, setMonthlyExtraPaymentInput] =
    useState(1000);
  const [prepayments, setPrepayments] = useState([]);

  // Floating rate functionality
  const [rateType, setRateType] = useState("fixed"); // 'fixed' or 'floating'
  const [rateSchedule, setRateSchedule] = useState([
    { fromMonth: 1, toMonth: 12, rate: 10 },
  ]);
  const [newRateMonth, setNewRateMonth] = useState("");
  const [newRateValue, setNewRateValue] = useState("");
  const [newPrepayMonth, setNewPrepayMonth] = useState("");
  const [newPrepayAmount, setNewPrepayAmount] = useState("");
  const [schedule, setSchedule] = useState([]);
  const [summary, setSummary] = useState({
    emi: 0,
    totalPayment: 0,
    totalInterest: 0,
    totalPrincipal: 0,
    totalExtraPayments: 0,
    totalLumpsumPrepayments: 0,
    monthsCompleted: 0,
    monthsSaved: 0,
    interestSaved: 0,
  });

  // Calculate EMI
  const calculateEMI = (principal, annualRate, months) => {
    const monthlyRate = annualRate / 12 / 100;
    return (
      (principal * monthlyRate * Math.pow(1 + monthlyRate, months)) /
      (Math.pow(1 + monthlyRate, months) - 1)
    );
  };

  // Calculate total interest for normal loan without prepayments
  const calculateNormalLoanInterest = (principal, annualRate, months) => {
    const monthlyEMI = calculateEMI(principal, annualRate, months);
    return monthlyEMI * months - principal;
  };

  // Generate amortization schedule with floating rates
  const generateSchedule = () => {
    let remainingBalance = loanAmount;
    let newSchedule = [];
    let sortedPrepayments = [...prepayments].sort((a, b) => a.month - b.month);
    let prepaymentIndex = 0;
    let rateChangeCount = 0;
    let lastRate = null;
    let currentEMI = 0;

    // Calculate normal loan interest for comparison (using initial rate)
    const initialRate =
      rateType === "fixed" ? interestRate : getRateForMonth(1);
    const normalLoanInterest = calculateNormalLoanInterest(
      loanAmount,
      initialRate,
      loanPeriod
    );

    for (let month = 1; month <= loanPeriod && remainingBalance > 0; month++) {
      // Get the current rate for this month
      const currentRate = getRateForMonth(month);
      const monthlyRate = currentRate / 12 / 100;

      // Check if rate changed
      if (lastRate !== null && lastRate !== currentRate) {
        rateChangeCount++;

        // For floating rate: Recalculate EMI to maintain tenure
        if (rateType === "floating") {
          const remainingMonths = loanPeriod - month + 1;
          currentEMI = calculateEMI(
            remainingBalance,
            currentRate,
            remainingMonths
          );
        }
      } else if (month === 1) {
        // First month calculation
        currentEMI = calculateEMI(loanAmount, currentRate, loanPeriod);
      }

      // Calculate interest for the month
      const interestForMonth = remainingBalance * monthlyRate;

      // Calculate principal for the month
      let principalForMonth = currentEMI - interestForMonth;

      // Adjust if this is the last payment
      if (principalForMonth > remainingBalance) {
        principalForMonth = remainingBalance;
        currentEMI = principalForMonth + interestForMonth;
      }

      // Calculate monthly extra payment
      let extraPaymentForMonth = 0;
      if (
        monthlyExtraPayment > 0 &&
        remainingBalance - principalForMonth > monthlyExtraPayment
      ) {
        extraPaymentForMonth = monthlyExtraPayment;
      } else if (monthlyExtraPayment > 0) {
        // If remaining balance after principal payment is less than extra payment,
        // only pay what's left
        extraPaymentForMonth =
          remainingBalance - principalForMonth > 0
            ? remainingBalance - principalForMonth
            : 0;
      }

      // Check if there's a lumpsum prepayment for this month
      let lumpsumPrepayment = 0;
      if (
        prepaymentIndex < sortedPrepayments.length &&
        sortedPrepayments[prepaymentIndex].month === month
      ) {
        lumpsumPrepayment = sortedPrepayments[prepaymentIndex].amount;
        prepaymentIndex++;
      }

      // Calculate new remaining balance
      remainingBalance =
        remainingBalance -
        principalForMonth -
        extraPaymentForMonth -
        lumpsumPrepayment;

      // Ensure remaining balance doesn't go negative
      if (remainingBalance < 0) {
        remainingBalance = 0;
      }

      // Add to schedule
      newSchedule.push({
        month,
        rate: currentRate,
        emi: currentEMI,
        interest: interestForMonth,
        principal: principalForMonth,
        extraPayment: extraPaymentForMonth,
        lumpsumPrepayment: lumpsumPrepayment,
        totalPayment: currentEMI + extraPaymentForMonth + lumpsumPrepayment,
        balance: remainingBalance,
        rateChanged: lastRate !== null && lastRate !== currentRate,
      });

      lastRate = currentRate;

      // If balance is zero, we're done
      if (remainingBalance === 0) {
        break;
      }
    }

    // Calculate totals
    const totalPayment = newSchedule.reduce(
      (sum, row) => sum + row.emi + row.extraPayment + row.lumpsumPrepayment,
      0
    );
    const totalInterest = newSchedule.reduce(
      (sum, row) => sum + row.interest,
      0
    );
    const totalExtraPayments = newSchedule.reduce(
      (sum, row) => sum + row.extraPayment,
      0
    );
    const totalLumpsumPrepayments = newSchedule.reduce(
      (sum, row) => sum + row.lumpsumPrepayment,
      0
    );
    const totalPrincipal = loanAmount;
    const interestSaved = normalLoanInterest - totalInterest;

    // Calculate average EMI for summary display
    const avgEMI =
      newSchedule.length > 0
        ? newSchedule.reduce((sum, row) => sum + row.emi, 0) /
          newSchedule.length
        : 0;

    setSchedule(newSchedule);
    setSummary({
      emi: avgEMI,
      totalPayment,
      totalInterest,
      totalPrincipal,
      totalExtraPayments,
      totalLumpsumPrepayments,
      monthsCompleted: newSchedule.length,
      monthsSaved: loanPeriod - newSchedule.length,
      interestSaved,
      rateChanges: rateChangeCount,
      totalPayable: totalInterest + loanAmount,
    });
  };

  // Handle key press events for monthly extra payment
  const handleMonthlyExtraPaymentKeyPress = (e) => {
    if (e.key === "Enter") {
      setMonthlyExtraPayment(monthlyExtraPaymentInput);
    }
  };

  // Get applicable rate for a given month
  const getRateForMonth = (month) => {
    if (rateType === "fixed") return interestRate;

    const applicableRate = rateSchedule.find(
      (rate) => month >= rate.fromMonth && month <= rate.toMonth
    );
    return applicableRate ? applicableRate.rate : interestRate;
  };

  // Add new floating rate change
  const addFloatingRateChange = () => {
    if (newRateMonth && newRateValue) {
      const month = parseInt(newRateMonth);
      const rate = parseFloat(newRateValue);

      if (month > 0 && month <= loanPeriod && rate > 0) {
        // Create a new rate schedule with the new rate
        let updatedSchedule = [...rateSchedule];

        // Find where to insert the new rate change
        let insertIndex = updatedSchedule.findIndex((r) => month < r.toMonth);

        if (insertIndex === -1) {
          // Add at the end
          const lastPeriod = updatedSchedule[updatedSchedule.length - 1];
          if (month > lastPeriod.toMonth) {
            updatedSchedule.push({
              fromMonth: month,
              toMonth: loanPeriod,
              rate,
            });
          } else {
            lastPeriod.toMonth = month - 1;
            updatedSchedule.push({
              fromMonth: month,
              toMonth: loanPeriod,
              rate,
            });
          }
        } else {
          // Insert in the middle
          const existingPeriod = updatedSchedule[insertIndex];
          if (month > existingPeriod.fromMonth) {
            // Split existing period
            const newPeriod1 = { ...existingPeriod, toMonth: month - 1 };
            const newPeriod2 = {
              fromMonth: month,
              toMonth: existingPeriod.toMonth,
              rate,
            };
            updatedSchedule[insertIndex] = newPeriod1;
            updatedSchedule.splice(insertIndex + 1, 0, newPeriod2);
          } else {
            // Replace from this point
            existingPeriod.fromMonth = month;
            existingPeriod.rate = rate;
          }
        }

        // Clean up and sort
        updatedSchedule = updatedSchedule
          .filter((r) => r.fromMonth <= r.toMonth)
          .sort((a, b) => a.fromMonth - b.fromMonth);

        setRateSchedule(updatedSchedule);
        setNewRateMonth("");
        setNewRateValue("");
      }
    }
  };

  // Remove a floating rate period
  const removeFloatingRatePeriod = (index) => {
    const newSchedule = rateSchedule.filter((_, i) => i !== index);
    if (newSchedule.length > 0) {
      setRateSchedule(newSchedule);
    }
  };

  // Reset to fixed rate
  const resetToFixedRate = () => {
    setRateSchedule([
      { fromMonth: 1, toMonth: loanPeriod, rate: interestRate },
    ]);
    setRateType("fixed");
  };

  // Add a new prepayment
  const addPrepayment = () => {
    if (newPrepayMonth && newPrepayAmount) {
      const month = parseInt(newPrepayMonth);
      const amount = parseFloat(newPrepayAmount);

      if (
        !isNaN(month) &&
        !isNaN(amount) &&
        month > 0 &&
        month <= loanPeriod &&
        amount > 0
      ) {
        setPrepayments([...prepayments, { month, amount }]);
        setNewPrepayMonth("");
        setNewPrepayAmount("");
      }
    }
  };

  // Remove a prepayment
  const removePrepayment = (index) => {
    const newPrepayments = [...prepayments];
    newPrepayments.splice(index, 1);
    setPrepayments(newPrepayments);
  };

  // Run calculation when inputs change
  useEffect(() => {
    generateSchedule();
  }, [
    loanAmount,
    interestRate,
    loanPeriod,
    prepayments,
    monthlyExtraPayment,
    rateType,
    rateSchedule,
    generateSchedule, // Added missing dependency
  ]);

  // Update rate schedule when switching rate types or changing base rate
  useEffect(() => {
    if (rateType === "fixed") {
      setRateSchedule([
        { fromMonth: 1, toMonth: loanPeriod, rate: interestRate },
      ]);
    } else if (rateSchedule.length === 1 && rateSchedule[0].fromMonth === 1) {
      // Initialize floating rate schedule with current rate
      setRateSchedule([
        { fromMonth: 1, toMonth: loanPeriod, rate: interestRate },
      ]);
    }
  }, [rateType, interestRate, loanPeriod, rateSchedule]); // Added missing dependency

  // Prepare chart data
  const chartData = schedule.map((row) => ({
    month: row.month,
    principal: row.principal,
    interest: row.interest,
    extraPayment: row.extraPayment,
    lumpsumPrepayment: row.lumpsumPrepayment,
    balance: row.balance,
    rate: row.rate || interestRate,
    rateChanged: row.rateChanged || false,
  }));

  // Format currency
  const formatCurrency = (value) => {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 0,
    }).format(value);
  };

  // Format months to years and months
  const formatMonthsToYearsMonths = (totalMonths) => {
    if (totalMonths === 0) return "0 months";

    const years = Math.floor(totalMonths / 12);
    const months = totalMonths % 12;

    let result = "";

    if (years > 0) {
      result += `${years} year${years > 1 ? "s" : ""}`;
    }

    if (months > 0) {
      if (result) result += " ";
      result += `${months} month${months > 1 ? "s" : ""}`;
    }

    return result;
  };

  return (
    <div className="calculator-container">
      <h1 className="title">Bank EMI Calculator with Prepayment Options</h1>

      <div className="input-section">
        <div className="loan-details">
          <h2 className="section-title">Loan Details</h2>

          <div className="input-group">
            <label>Loan Amount</label>
            <input
              type="number"
              value={loanAmount}
              onChange={(e) => setLoanAmount(parseFloat(e.target.value) || 0)}
            />
          </div>

          <div className="input-group">
            <label>Interest Rate Type</label>
            <div className="rate-type-toggle">
              <button
                type="button"
                className={`rate-toggle-btn ${
                  rateType === "fixed" ? "active" : ""
                }`}
                onClick={() => setRateType("fixed")}
              >
                <span className="rate-toggle-icon">📊</span>
                <span className="rate-toggle-text">Fixed Rate</span>
                <span className="rate-toggle-desc">
                  Constant rate throughout
                </span>
              </button>
              <button
                type="button"
                className={`rate-toggle-btn ${
                  rateType === "floating" ? "active" : ""
                }`}
                onClick={() => setRateType("floating")}
              >
                <span className="rate-toggle-icon">📈</span>
                <span className="rate-toggle-text">Floating Rate</span>
                <span className="rate-toggle-desc">Rate changes over time</span>
              </button>
            </div>
          </div>

          <div className="input-group">
            <label>
              {rateType === "fixed"
                ? "Interest Rate (%)"
                : "Initial Interest Rate (%)"}
            </label>
            <input
              type="number"
              value={interestRate}
              onChange={(e) => setInterestRate(parseFloat(e.target.value) || 0)}
              step="0.01"
            />
          </div>

          <div className="input-group">
            <label>Loan Period (months)</label>
            <input
              type="number"
              value={loanPeriod}
              onChange={(e) =>
                setLoanPeriod(
                  e.target.value === "" ? 0 : parseInt(e.target.value)
                )
              }
            />
            <div className="form-help-text">
              {loanPeriod > 0 && `${formatMonthsToYearsMonths(loanPeriod)}`}
            </div>
          </div>

          <div className="input-group">
            <label>Monthly Extra Payment - Press Enter to apply</label>
            <input
              type="number"
              value={monthlyExtraPaymentInput}
              onChange={(e) =>
                setMonthlyExtraPaymentInput(
                  e.target.value === "" ? 0 : parseFloat(e.target.value)
                )
              }
              onKeyPress={handleMonthlyExtraPaymentKeyPress}
              min="0"
            />
          </div>
        </div>

        <div className="prepayments-section">
          <h2 className="section-title">Prepayments & Rate Management</h2>

          {rateType === "floating" && (
            <div
              style={{
                marginBottom: "24px",
                padding: "16px",
                backgroundColor: "#f0f9ff",
                borderRadius: "8px",
                border: "1px solid #bae6fd",
              }}
            >
              <h3
                style={{
                  marginBottom: "12px",
                  fontWeight: "600",
                  color: "#0369a1",
                }}
              >
                Floating Rate Schedule
              </h3>

              <div style={{ marginBottom: "16px" }}>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    marginBottom: "8px",
                  }}
                >
                  <span style={{ fontSize: "14px", fontWeight: "600" }}>
                    Current Rate Periods
                  </span>
                  <button
                    onClick={resetToFixedRate}
                    style={{
                      padding: "4px 8px",
                      fontSize: "12px",
                      backgroundColor: "#f3f4f6",
                      color: "#374151",
                      border: "1px solid #d1d5db",
                      borderRadius: "4px",
                      cursor: "pointer",
                    }}
                  >
                    Reset to Fixed
                  </button>
                </div>
                <div style={{ maxHeight: "120px", overflowY: "auto" }}>
                  {rateSchedule.map((rate, index) => (
                    <div
                      key={index}
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        padding: "8px",
                        backgroundColor: "white",
                        borderRadius: "4px",
                        marginBottom: "4px",
                        border: "1px solid #e5e7eb",
                      }}
                    >
                      <div style={{ fontSize: "14px" }}>
                        <div style={{ fontWeight: "500" }}>
                          Months {rate.fromMonth} - {rate.toMonth}
                        </div>
                        <div style={{ color: "#2563eb", fontWeight: "600" }}>
                          {rate.rate.toFixed(2)}%
                        </div>
                      </div>
                      <button
                        onClick={() => removeFloatingRatePeriod(index)}
                        style={{
                          color: "#ef4444",
                          fontWeight: "bold",
                          fontSize: "16px",
                          background: "none",
                          border: "none",
                          cursor: "pointer",
                        }}
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              <div style={{ marginBottom: "16px" }}>
                <h4
                  style={{
                    marginBottom: "8px",
                    fontSize: "14px",
                    fontWeight: "600",
                  }}
                >
                  Add Rate Change
                </h4>
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr 1fr",
                    gap: "8px",
                    marginBottom: "8px",
                  }}
                >
                  <input
                    type="number"
                    value={newRateMonth}
                    onChange={(e) => setNewRateMonth(e.target.value)}
                    placeholder="From Month"
                    style={{
                      padding: "8px",
                      border: "1px solid #d1d5db",
                      borderRadius: "4px",
                    }}
                  />
                  <input
                    type="number"
                    value={newRateValue}
                    onChange={(e) => setNewRateValue(e.target.value)}
                    placeholder="New Rate %"
                    step="0.1"
                    style={{
                      padding: "8px",
                      border: "1px solid #d1d5db",
                      borderRadius: "4px",
                    }}
                  />
                </div>
                <button
                  onClick={addFloatingRateChange}
                  style={{
                    width: "100%",
                    padding: "8px",
                    backgroundColor: "#2563eb",
                    color: "white",
                    border: "none",
                    borderRadius: "4px",
                    cursor: "pointer",
                    fontWeight: "600",
                  }}
                >
                  Add Rate Change
                </button>
              </div>

              {/* Interest Rate Changes Chart */}
              <div style={{ marginTop: "16px" }}>
                <h4
                  style={{
                    marginBottom: "12px",
                    fontSize: "14px",
                    fontWeight: "600",
                    color: "#0369a1",
                  }}
                >
                  Interest Rate Changes Over Time
                </h4>
                <div
                  style={{
                    backgroundColor: "white",
                    padding: "16px",
                    borderRadius: "8px",
                    border: "1px solid #e5e7eb",
                  }}
                >
                  <ResponsiveContainer width="100%" height={250}>
                    <LineChart data={chartData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis
                        dataKey="month"
                        label={{
                          value: "Month",
                          position: "insideBottom",
                          offset: -5,
                        }}
                      />
                      <YAxis domain={["dataMin - 0.5", "dataMax + 0.5"]} />
                      <Tooltip
                        formatter={(value) => [
                          `${value.toFixed(2)}%`,
                          "Interest Rate",
                        ]}
                        labelFormatter={(month) => `Month ${month}`}
                      />
                      <Line
                        type="stepAfter"
                        dataKey="rate"
                        stroke="#8b5cf6"
                        strokeWidth={3}
                        name="Interest Rate %"
                        dot={{ fill: "#8b5cf6", strokeWidth: 2, r: 4 }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>
          )}

          <h3
            className="section-title"
            style={{ fontSize: "1rem", marginBottom: "12px" }}
          >
            Lumpsum Prepayments
          </h3>

          <div className="prepayment-header">
            <span>Month</span>
            <span>Amount</span>
            <span></span>
          </div>

          {prepayments.map((prepay, index) => (
            <div key={index} className="prepayment-row">
              <input
                type="number"
                value={prepay.month}
                onChange={(e) => {
                  const newPrepayments = [...prepayments];
                  newPrepayments[index].month = parseInt(e.target.value) || 0;
                  setPrepayments(newPrepayments);
                }}
              />
              <input
                type="number"
                value={prepay.amount}
                onChange={(e) => {
                  const newPrepayments = [...prepayments];
                  newPrepayments[index].amount =
                    parseFloat(e.target.value) || 0;
                  setPrepayments(newPrepayments);
                }}
              />
              <button
                onClick={() => removePrepayment(index)}
                className="remove-btn"
              >
                X
              </button>
            </div>
          ))}

          <div className="prepayment-row">
            <input
              type="number"
              value={newPrepayMonth}
              onChange={(e) => setNewPrepayMonth(e.target.value)}
              placeholder="Month"
            />
            <input
              type="number"
              value={newPrepayAmount}
              onChange={(e) => setNewPrepayAmount(e.target.value)}
              placeholder="Amount"
            />
            <button onClick={addPrepayment} className="add-btn">
              +
            </button>
          </div>
        </div>
      </div>

      <div className="summary-section">
        <h2 className="section-title">Summary</h2>

        <div className="summary-grid">
          <div className="summary-card">
            <div className="summary-label">
              {rateType === "floating" ? "Average EMI" : "Monthly EMI"}
            </div>
            <div className="summary-value emi">
              {formatCurrency(summary.emi)}
            </div>
          </div>

          <div className="summary-card">
            <div className="summary-label">Monthly Extra</div>
            <div className="summary-value extra">
              {formatCurrency(monthlyExtraPayment)}
            </div>
          </div>

          <div className="summary-card">
            <div className="summary-label">Total Interest</div>
            <div className="summary-value interest">
              {formatCurrency(summary.totalInterest)}
            </div>
          </div>

          <div className="summary-card">
            <div className="summary-label">Interest Saved</div>
            <div className="summary-value saved">
              {formatCurrency(summary.interestSaved)}
            </div>
          </div>

          <div className="summary-card">
            <div className="summary-label">Loan Period</div>
            <div className="summary-value period">
              {formatMonthsToYearsMonths(summary.monthsCompleted)}
            </div>
          </div>

          <div className="summary-card">
            <div className="summary-label">Months Saved</div>
            <div className="summary-value saved">
              {formatMonthsToYearsMonths(summary.monthsSaved)}
            </div>
          </div>

          {rateType === "floating" && (
            <div className="summary-card">
              <div className="summary-label">Rate Changes</div>
              <div className="summary-value period">
                {summary.rateChanges || 0}
              </div>
            </div>
          )}

          <div className="summary-card">
            <div className="summary-label">Total Amount payable</div>
            <div className="summary-value extra">
              {formatCurrency(summary.totalPayable)}
            </div>
          </div>
        </div>
      </div>

      <div className="chart-section">
        <h2 className="section-title">Payment Breakdown</h2>
        <div className="chart-container">
          <ResponsiveContainer width="100%" height={300}>
            <BarChart
              data={chartData}
              margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
              stackOffset="expand"
            >
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis
                dataKey="month"
                label={{ value: "Month", position: "insideBottom", offset: -5 }}
              />
              <YAxis />
              <Tooltip formatter={(value) => formatCurrency(value)} />
              <Legend />
              <Bar
                dataKey="interest"
                stackId="a"
                name="Interest"
                fill="#f87171"
              />
              <Bar
                dataKey="principal"
                stackId="a"
                name="Principal"
                fill="#60a5fa"
              />
              <Bar
                dataKey="extraPayment"
                stackId="a"
                name="Monthly Extra"
                fill="#a78bfa"
              />
              <Bar
                dataKey="lumpsumPrepayment"
                stackId="a"
                name="Lumpsum"
                fill="#34d399"
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="chart-section">
        <h2 className="section-title">Outstanding Balance</h2>
        <div className="chart-container">
          <ResponsiveContainer width="100%" height={300}>
            <LineChart
              data={chartData}
              margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
            >
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis
                dataKey="month"
                label={{ value: "Month", position: "insideBottom", offset: -5 }}
              />
              <YAxis />
              <Tooltip formatter={(value) => formatCurrency(value)} />
              <Legend />
              <Line
                type="monotone"
                dataKey="balance"
                name="Outstanding Balance"
                stroke="#8884d8"
                strokeWidth={2}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="table-section">
        <h2 className="section-title">Amortization Schedule</h2>

        <div className="table-container">
          <table className="schedule-table">
            <thead>
              <tr>
                <th>Month</th>
                {rateType === "floating" && <th>Rate %</th>}
                <th>EMI</th>
                <th>Principal</th>
                <th>Interest</th>
                <th>Monthly Extra</th>
                <th>Lumpsum</th>
                <th>Balance</th>
              </tr>
            </thead>
            <tbody>
              {schedule.map((row, index) => (
                <tr
                  key={index}
                  className={`${
                    row.lumpsumPrepayment > 0 || row.extraPayment > 0
                      ? "highlight"
                      : ""
                  } ${row.rateChanged ? "rate-changed" : ""}`}
                >
                  <td>{row.month}</td>
                  {rateType === "floating" && (
                    <td className={row.rateChanged ? "rate-highlight" : ""}>
                      {row.rate
                        ? `${row.rate.toFixed(2)}%`
                        : `${interestRate.toFixed(2)}%`}
                    </td>
                  )}
                  <td>{formatCurrency(row.emi)}</td>
                  <td>{formatCurrency(row.principal)}</td>
                  <td>{formatCurrency(row.interest)}</td>
                  <td className="extra-payment">
                    {formatCurrency(row.extraPayment)}
                  </td>
                  <td className="lumpsum-payment">
                    {formatCurrency(row.lumpsumPrepayment)}
                  </td>
                  <td>{formatCurrency(row.balance)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default EMICalculator;
