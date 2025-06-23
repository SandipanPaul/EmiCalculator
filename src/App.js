import React, { useState, useEffect, useCallback } from "react";
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
  PieChart,
  Pie,
  Cell,
  ComposedChart,
  Area,
} from "recharts";

const EnhancedCalculator = () => {
  const [activeTab, setActiveTab] = useState("loan");

  // Loan Management State
  const [loanAmount, setLoanAmount] = useState(100000);
  const [interestRate, setInterestRate] = useState(10);
  const [loanPeriod, setLoanPeriod] = useState(12);
  const [monthlyExtraPayment, setMonthlyExtraPayment] = useState(1000);
  const [monthlyExtraPaymentInput, setMonthlyExtraPaymentInput] =
    useState(1000);
  const [prepayments, setPrepayments] = useState([]);
  const [rateType, setRateType] = useState("fixed");
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

  // SIP Calculator State
  const [sipTarget, setSipTarget] = useState(0);
  const [sipPeriod, setSipPeriod] = useState(12);
  const [sipReturnRate, setSipReturnRate] = useState(12);
  const [sipAmount, setSipAmount] = useState(0);
  const [sipCalculationType, setSipCalculationType] = useState("interest"); // "interest" or "total"
  const [sipCalculation, setSipCalculation] = useState({
    totalInterestToPay: 0,
    requiredSip: 0,
    totalSipInvestment: 0,
    sipReturns: 0,
    netBenefit: 0,
    sipSchedule: [],
  });

  // Calculate EMI
  const calculateEMI = useCallback((principal, annualRate, months) => {
    const monthlyRate = annualRate / 12 / 100;
    return (
      (principal * monthlyRate * Math.pow(1 + monthlyRate, months)) /
      (Math.pow(1 + monthlyRate, months) - 1)
    );
  }, []);

  // Calculate SIP amount needed to accumulate target amount
  const calculateSIP = useCallback((targetAmount, annualRate, months) => {
    const monthlyRate = annualRate / 12 / 100;
    if (monthlyRate === 0) return targetAmount / months;
    return (
      (targetAmount * monthlyRate) / (Math.pow(1 + monthlyRate, months) - 1)
    );
  }, []);

  // Get applicable rate for a given month
  const getRateForMonth = useCallback(
    (month) => {
      if (rateType === "fixed") return interestRate;
      const applicableRate = rateSchedule.find(
        (rate) => month >= rate.fromMonth && month <= rate.toMonth
      );
      return applicableRate ? applicableRate.rate : interestRate;
    },
    [rateType, interestRate, rateSchedule]
  );

  // Calculate total interest for normal loan without prepayments
  const calculateNormalLoanInterest = useCallback(
    (principal, annualRate, months) => {
      const monthlyEMI = calculateEMI(principal, annualRate, months);
      return monthlyEMI * months - principal;
    },
    [calculateEMI]
  );

  // SIP Calculation Effect
  useEffect(() => {
    // Use the sipAmount directly if it's set, otherwise calculate from target
    const requiredSip =
      sipAmount > 0
        ? sipAmount
        : sipTarget > 0
        ? calculateSIP(sipTarget, sipReturnRate, sipPeriod)
        : 0;
    const totalSipInvestment = requiredSip * sipPeriod;

    // Calculate what this SIP will accumulate to
    const monthlyReturnRate = sipReturnRate / 12 / 100;
    let sipReturns = 0;
    for (let i = 1; i <= sipPeriod; i++) {
      sipReturns +=
        requiredSip * Math.pow(1 + monthlyReturnRate, sipPeriod - i + 1);
    }

    const netBenefit = sipReturns - totalSipInvestment;

    // Generate SIP schedule
    const sipSchedule = [];
    let cumulativeInvestment = 0;
    let cumulativeReturns = 0;

    for (let month = 1; month <= sipPeriod; month++) {
      cumulativeInvestment += requiredSip;
      // Calculate compound growth for each month's investment
      let monthReturns = 0;
      for (let i = 1; i <= month; i++) {
        const monthsRemaining = month - i + 1;
        monthReturns +=
          requiredSip * Math.pow(1 + monthlyReturnRate, monthsRemaining - 1);
      }
      cumulativeReturns = monthReturns;

      sipSchedule.push({
        month,
        sipAmount: requiredSip,
        cumulativeInvestment,
        cumulativeReturns,
        growth: cumulativeReturns - cumulativeInvestment,
      });
    }

    setSipCalculation({
      targetAmount: sipTarget,
      calculationType: sipCalculationType,
      requiredSip,
      totalSipInvestment,
      sipReturns,
      netBenefit,
      sipSchedule,
    });
  }, [
    sipTarget,
    sipPeriod,
    sipReturnRate,
    sipAmount,
    sipCalculationType,
    calculateSIP,
  ]);

  // Loan calculation effect (restored to original logic)
  useEffect(() => {
    const generateSchedule = () => {
      let remainingBalance = loanAmount;
      let newSchedule = [];
      let sortedPrepayments = [...prepayments].sort(
        (a, b) => a.month - b.month
      );
      let prepaymentIndex = 0;
      let rateChangeCount = 0;
      let lastRate = null;
      let currentEMI = 0;

      const initialRate =
        rateType === "fixed" ? interestRate : getRateForMonth(1);
      const normalLoanInterest = calculateNormalLoanInterest(
        loanAmount,
        initialRate,
        loanPeriod
      );

      for (
        let month = 1;
        month <= loanPeriod && remainingBalance > 0;
        month++
      ) {
        const currentRate = getRateForMonth(month);
        const monthlyRate = currentRate / 12 / 100;

        if (lastRate !== null && lastRate !== currentRate) {
          rateChangeCount++;
          if (rateType === "floating") {
            const remainingMonths = loanPeriod - month + 1;
            currentEMI = calculateEMI(
              remainingBalance,
              currentRate,
              remainingMonths
            );
          }
        } else if (month === 1) {
          currentEMI = calculateEMI(loanAmount, currentRate, loanPeriod);
        }

        const interestForMonth = remainingBalance * monthlyRate;
        let principalForMonth = currentEMI - interestForMonth;

        if (principalForMonth > remainingBalance) {
          principalForMonth = remainingBalance;
          currentEMI = principalForMonth + interestForMonth;
        }

        let extraPaymentForMonth = 0;
        if (
          monthlyExtraPayment > 0 &&
          remainingBalance - principalForMonth > monthlyExtraPayment
        ) {
          extraPaymentForMonth = monthlyExtraPayment;
        } else if (monthlyExtraPayment > 0) {
          extraPaymentForMonth =
            remainingBalance - principalForMonth > 0
              ? remainingBalance - principalForMonth
              : 0;
        }

        let lumpsumPrepayment = 0;
        if (
          prepaymentIndex < sortedPrepayments.length &&
          sortedPrepayments[prepaymentIndex].month === month
        ) {
          lumpsumPrepayment = sortedPrepayments[prepaymentIndex].amount;
          prepaymentIndex++;
        }

        remainingBalance =
          remainingBalance -
          principalForMonth -
          extraPaymentForMonth -
          lumpsumPrepayment;
        if (remainingBalance < 0) remainingBalance = 0;

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
        if (remainingBalance === 0) break;
      }

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

    generateSchedule();
  }, [
    loanAmount,
    interestRate,
    loanPeriod,
    prepayments,
    monthlyExtraPayment,
    rateType,
    rateSchedule,
    calculateNormalLoanInterest,
    getRateForMonth,
    calculateEMI,
  ]);

  // Helper functions (existing ones)
  const addFloatingRateChange = () => {
    if (newRateMonth && newRateValue) {
      const month = parseInt(newRateMonth);
      const rate = parseFloat(newRateValue);

      if (month > 0 && month <= loanPeriod && rate > 0) {
        let updatedSchedule = [...rateSchedule];
        let insertIndex = updatedSchedule.findIndex(
          (r) => month >= r.fromMonth && month <= r.toMonth
        );

        if (insertIndex === -1) {
          const lastPeriod = updatedSchedule[updatedSchedule.length - 1];
          if (month > lastPeriod.toMonth) {
            updatedSchedule.push({
              fromMonth: month,
              toMonth: loanPeriod,
              rate,
            });
          }
        } else {
          const existingPeriod = updatedSchedule[insertIndex];
          if (month === existingPeriod.fromMonth) {
            updatedSchedule.splice(insertIndex, 0, {
              fromMonth: month,
              toMonth: existingPeriod.toMonth,
              rate,
            });
            updatedSchedule[insertIndex + 1].toMonth = month - 1;
          } else {
            const before = { ...existingPeriod, toMonth: month - 1 };
            const after = {
              fromMonth: month,
              toMonth: existingPeriod.toMonth,
              rate,
            };
            updatedSchedule[insertIndex] = before;
            updatedSchedule.splice(insertIndex + 1, 0, after);
          }
        }

        updatedSchedule = updatedSchedule
          .filter((r) => r.fromMonth <= r.toMonth)
          .sort((a, b) => a.fromMonth - b.fromMonth);
        setRateSchedule(updatedSchedule);
        setNewRateMonth("");
        setNewRateValue("");
      }
    }
  };

  const removeFloatingRatePeriod = (index) => {
    const newSchedule = rateSchedule.filter((_, i) => i !== index);
    if (newSchedule.length > 0) setRateSchedule(newSchedule);
  };

  const resetToFixedRate = () => {
    setRateSchedule([
      { fromMonth: 1, toMonth: loanPeriod, rate: interestRate },
    ]);
    setRateType("fixed");
  };

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

  const removePrepayment = (index) => {
    const newPrepayments = [...prepayments];
    newPrepayments.splice(index, 1);
    setPrepayments(newPrepayments);
  };

  useEffect(() => {
    if (rateType === "fixed") {
      setRateSchedule([
        { fromMonth: 1, toMonth: loanPeriod, rate: interestRate },
      ]);
    } else if (
      rateSchedule.length === 1 &&
      rateSchedule[0].fromMonth === 1 &&
      rateSchedule[0].toMonth === loanPeriod &&
      rateSchedule[0].rate !== interestRate
    ) {
      setRateSchedule([
        { fromMonth: 1, toMonth: loanPeriod, rate: interestRate },
      ]);
    }
  }, [rateType, interestRate, loanPeriod, rateSchedule]);

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

  const formatCurrency = (value) => {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 0,
    }).format(value);
  };

  const formatMonthsToYearsMonths = (totalMonths) => {
    if (totalMonths === 0) return "0 months";
    const years = Math.floor(totalMonths / 12);
    const months = totalMonths % 12;
    let result = "";
    if (years > 0) result += `${years} year${years > 1 ? "s" : ""}`;
    if (months > 0) {
      if (result) result += " ";
      result += `${months} month${months > 1 ? "s" : ""}`;
    }
    return result;
  };

  const handleMonthlyExtraPaymentKeyPress = (e) => {
    if (e.key === "Enter") {
      setMonthlyExtraPayment(monthlyExtraPaymentInput);
    }
  };

  // Copy loan values to SIP calculator
  const copyLoanToSip = (calculationType) => {
    setSipPeriod(loanPeriod);

    // Use actual summary values and round them to avoid decimal precision issues
    const totalInterest = Math.round(summary.totalInterest);
    const totalAmountPayable = Math.round(summary.totalPayable);
    const targetAmount =
      calculationType === "total" ? totalAmountPayable : totalInterest;
    const requiredSip = calculateSIP(targetAmount, sipReturnRate, loanPeriod);

    // Set the calculated target amount and SIP amount (round SIP to 2 decimal places)
    setSipTarget(targetAmount);
    setSipAmount(Math.round(requiredSip * 100) / 100);

    // Store calculation type for SIP tab reference
    setSipCalculationType(calculationType);

    // Switch to SIP tab
    setActiveTab("sip");
  };

  const comparisonData = [
    {
      name:
        sipCalculation.calculationType === "total" &&
        sipCalculation.targetAmount > 0
          ? "Total Loan Cost"
          : sipCalculation.calculationType === "interest" &&
            sipCalculation.targetAmount > 0
          ? "Interest to Pay"
          : "SIP Target",
      value: sipTarget > 0 ? sipTarget : sipCalculation.totalSipInvestment || 0,
      color:
        sipCalculation.calculationType === "total"
          ? "#7c3aed"
          : sipCalculation.calculationType === "interest"
          ? "#ef4444"
          : "#3b82f6",
    },
    {
      name: "SIP Returns",
      value: sipCalculation.sipReturns || 0,
      color: "#10b981",
    },
  ];

  return (
    <div
      style={{
        maxWidth: "1400px",
        margin: "0 auto",
        padding: "32px",
        fontFamily:
          '-apple-system, BlinkMacSystemFont, "Segoe UI", "Roboto", "Oxygen", "Ubuntu", "Cantarell", "Fira Sans", "Droid Sans", "Helvetica Neue", sans-serif',
        background: "linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%)",
        minHeight: "100vh",
      }}
    >
      {/* Header */}
      <h1
        style={{
          textAlign: "center",
          background: "linear-gradient(135deg, #1e40af, #3b82f6)",
          WebkitBackgroundClip: "text",
          WebkitTextFillColor: "transparent",
          backgroundClip: "text",
          fontSize: "2.5rem",
          fontWeight: "800",
          marginBottom: "40px",
          letterSpacing: "-0.02em",
        }}
      >
        Financial Calculator Suite
      </h1>

      {/* Tab Navigation */}
      <div
        style={{
          display: "flex",
          background: "rgba(255, 255, 255, 0.9)",
          backdropFilter: "blur(10px)",
          borderRadius: "16px",
          padding: "8px",
          marginBottom: "32px",
          boxShadow: "0 8px 32px rgba(0, 0, 0, 0.1)",
          border: "1px solid rgba(226, 232, 240, 0.5)",
        }}
      >
        <button
          onClick={() => setActiveTab("loan")}
          style={{
            flex: 1,
            padding: "16px 24px",
            border: "none",
            borderRadius: "12px",
            cursor: "pointer",
            fontSize: "16px",
            fontWeight: "600",
            transition: "all 0.3s ease",
            background:
              activeTab === "loan"
                ? "linear-gradient(135deg, #3b82f6, #8b5cf6)"
                : "transparent",
            color: activeTab === "loan" ? "white" : "#374151",
            boxShadow:
              activeTab === "loan"
                ? "0 4px 12px rgba(59, 130, 246, 0.3)"
                : "none",
          }}
        >
          🏦 Loan Management
        </button>
        <button
          onClick={() => setActiveTab("sip")}
          style={{
            flex: 1,
            padding: "16px 24px",
            border: "none",
            borderRadius: "12px",
            cursor: "pointer",
            fontSize: "16px",
            fontWeight: "600",
            transition: "all 0.3s ease",
            background:
              activeTab === "sip"
                ? "linear-gradient(135deg, #10b981, #059669)"
                : "transparent",
            color: activeTab === "sip" ? "white" : "#374151",
            boxShadow:
              activeTab === "sip"
                ? "0 4px 12px rgba(16, 185, 129, 0.3)"
                : "none",
          }}
        >
          📈 SIP Alternative Calculator
        </button>
      </div>

      {/* Loan Management Tab */}
      {activeTab === "loan" && (
        <div>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: "40px",
              marginBottom: "40px",
            }}
          >
            {/* Loan Details */}
            <div
              style={{
                background: "rgba(255, 255, 255, 0.9)",
                backdropFilter: "blur(10px)",
                padding: "32px",
                borderRadius: "16px",
                border: "1px solid rgba(226, 232, 240, 0.5)",
                boxShadow: "0 8px 32px rgba(0, 0, 0, 0.1)",
                position: "relative",
                overflow: "hidden",
              }}
            >
              <div
                style={{
                  position: "absolute",
                  top: 0,
                  left: 0,
                  right: 0,
                  height: "4px",
                  background:
                    "linear-gradient(90deg, #3b82f6, #8b5cf6, #06b6d4)",
                  borderRadius: "16px 16px 0 0",
                }}
              ></div>

              <h2
                style={{
                  background: "linear-gradient(135deg, #1e40af, #7c3aed)",
                  WebkitBackgroundClip: "text",
                  WebkitTextFillColor: "transparent",
                  backgroundClip: "text",
                  fontSize: "1.4rem",
                  fontWeight: "700",
                  marginBottom: "24px",
                }}
              >
                Loan Details
              </h2>

              <div style={{ marginBottom: "20px" }}>
                <label
                  style={{
                    display: "block",
                    marginBottom: "8px",
                    fontWeight: "600",
                    color: "#374151",
                    fontSize: "14px",
                  }}
                >
                  Loan Amount
                </label>
                <input
                  type="number"
                  value={loanAmount}
                  onChange={(e) =>
                    setLoanAmount(parseFloat(e.target.value) || 0)
                  }
                  style={{
                    width: "100%",
                    padding: "12px 16px",
                    border: "2px solid #e5e7eb",
                    borderRadius: "12px",
                    fontSize: "16px",
                    background: "rgba(255, 255, 255, 0.8)",
                    outline: "none",
                  }}
                />
              </div>

              <div style={{ marginBottom: "20px" }}>
                <label
                  style={{
                    display: "block",
                    marginBottom: "8px",
                    fontWeight: "600",
                    color: "#374151",
                    fontSize: "14px",
                  }}
                >
                  Interest Rate Type
                </label>
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr 1fr",
                    gap: "12px",
                    marginTop: "8px",
                  }}
                >
                  <button
                    type="button"
                    onClick={() => setRateType("fixed")}
                    style={{
                      background:
                        rateType === "fixed"
                          ? "linear-gradient(135deg, #dbeafe, #bfdbfe)"
                          : "rgba(255, 255, 255, 0.8)",
                      border: `2px solid ${
                        rateType === "fixed" ? "#3b82f6" : "#e5e7eb"
                      }`,
                      borderRadius: "12px",
                      padding: "16px 12px",
                      cursor: "pointer",
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      textAlign: "center",
                    }}
                  >
                    <span style={{ fontSize: "24px", marginBottom: "8px" }}>
                      📊
                    </span>
                    <span
                      style={{
                        fontWeight: "600",
                        color: "#374151",
                        fontSize: "14px",
                        marginBottom: "4px",
                      }}
                    >
                      Fixed Rate
                    </span>
                    <span style={{ fontSize: "11px", color: "#6b7280" }}>
                      Constant rate throughout
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setRateType("floating")}
                    style={{
                      background:
                        rateType === "floating"
                          ? "linear-gradient(135deg, #dbeafe, #bfdbfe)"
                          : "rgba(255, 255, 255, 0.8)",
                      border: `2px solid ${
                        rateType === "floating" ? "#3b82f6" : "#e5e7eb"
                      }`,
                      borderRadius: "12px",
                      padding: "16px 12px",
                      cursor: "pointer",
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      textAlign: "center",
                    }}
                  >
                    <span style={{ fontSize: "24px", marginBottom: "8px" }}>
                      📈
                    </span>
                    <span
                      style={{
                        fontWeight: "600",
                        color: "#374151",
                        fontSize: "14px",
                        marginBottom: "4px",
                      }}
                    >
                      Floating Rate
                    </span>
                    <span style={{ fontSize: "11px", color: "#6b7280" }}>
                      Rate changes over time
                    </span>
                  </button>
                </div>
              </div>

              <div style={{ marginBottom: "20px" }}>
                <label
                  style={{
                    display: "block",
                    marginBottom: "8px",
                    fontWeight: "600",
                    color: "#374151",
                    fontSize: "14px",
                  }}
                >
                  {rateType === "fixed"
                    ? "Interest Rate (%)"
                    : "Initial Interest Rate (%)"}
                </label>
                <input
                  type="number"
                  value={interestRate}
                  onChange={(e) =>
                    setInterestRate(parseFloat(e.target.value) || 0)
                  }
                  step="0.01"
                  style={{
                    width: "100%",
                    padding: "12px 16px",
                    border: "2px solid #e5e7eb",
                    borderRadius: "12px",
                    fontSize: "16px",
                    background: "rgba(255, 255, 255, 0.8)",
                    outline: "none",
                  }}
                />
              </div>

              <div style={{ marginBottom: "20px" }}>
                <label
                  style={{
                    display: "block",
                    marginBottom: "8px",
                    fontWeight: "600",
                    color: "#374151",
                    fontSize: "14px",
                  }}
                >
                  Loan Period (months)
                </label>
                <input
                  type="number"
                  value={loanPeriod}
                  onChange={(e) =>
                    setLoanPeriod(
                      e.target.value === "" ? 0 : parseInt(e.target.value)
                    )
                  }
                  style={{
                    width: "100%",
                    padding: "12px 16px",
                    border: "2px solid #e5e7eb",
                    borderRadius: "12px",
                    fontSize: "16px",
                    background: "rgba(255, 255, 255, 0.8)",
                    outline: "none",
                  }}
                />
                {loanPeriod > 0 && (
                  <div
                    style={{
                      fontSize: "12px",
                      color: "#6b7280",
                      marginTop: "4px",
                      fontStyle: "italic",
                    }}
                  >
                    {formatMonthsToYearsMonths(loanPeriod)}
                  </div>
                )}
              </div>

              <div style={{ marginBottom: "20px" }}>
                <label
                  style={{
                    display: "block",
                    marginBottom: "8px",
                    fontWeight: "600",
                    color: "#374151",
                    fontSize: "14px",
                  }}
                >
                  Monthly Extra Payment - Press Enter to apply
                </label>
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
                  style={{
                    width: "100%",
                    padding: "12px 16px",
                    border: "2px solid #e5e7eb",
                    borderRadius: "12px",
                    fontSize: "16px",
                    background: "rgba(255, 255, 255, 0.8)",
                    outline: "none",
                  }}
                />
              </div>
            </div>

            {/* Prepayments Section - simplified for space */}
            <div
              style={{
                background: "rgba(255, 255, 255, 0.9)",
                backdropFilter: "blur(10px)",
                padding: "32px",
                borderRadius: "16px",
                border: "1px solid rgba(226, 232, 240, 0.5)",
                boxShadow: "0 8px 32px rgba(0, 0, 0, 0.1)",
                position: "relative",
                overflow: "hidden",
              }}
            >
              <div
                style={{
                  position: "absolute",
                  top: 0,
                  left: 0,
                  right: 0,
                  height: "4px",
                  background:
                    "linear-gradient(90deg, #3b82f6, #8b5cf6, #06b6d4)",
                  borderRadius: "16px 16px 0 0",
                }}
              ></div>

              <h2
                style={{
                  background: "linear-gradient(135deg, #1e40af, #7c3aed)",
                  WebkitBackgroundClip: "text",
                  WebkitTextFillColor: "transparent",
                  backgroundClip: "text",
                  fontSize: "1.4rem",
                  fontWeight: "700",
                  marginBottom: "24px",
                }}
              >
                Prepayments & Rate Management
              </h2>

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr",
                  gap: "12px",
                  marginBottom: "24px",
                }}
              >
                <button
                  onClick={() => copyLoanToSip("total")}
                  style={{
                    width: "100%",
                    padding: "12px",
                    background: "linear-gradient(135deg, #3b82f6, #1e40af)",
                    color: "white",
                    border: "none",
                    borderRadius: "12px",
                    cursor: "pointer",
                    fontWeight: "600",
                    fontSize: "14px",
                    boxShadow: "0 4px 12px rgba(59, 130, 246, 0.3)",
                    transition: "all 0.3s ease",
                  }}
                >
                  📊 Calculate SIP on Total Amount Payable
                  <div
                    style={{
                      fontSize: "12px",
                      fontWeight: "400",
                      marginTop: "4px",
                      opacity: "0.9",
                    }}
                  >
                    {formatCurrency(summary.totalPayable)}
                  </div>
                </button>

                <button
                  onClick={() => copyLoanToSip("interest")}
                  style={{
                    width: "100%",
                    padding: "12px",
                    background: "linear-gradient(135deg, #10b981, #059669)",
                    color: "white",
                    border: "none",
                    borderRadius: "12px",
                    cursor: "pointer",
                    fontWeight: "600",
                    fontSize: "14px",
                    boxShadow: "0 4px 12px rgba(16, 185, 129, 0.3)",
                    transition: "all 0.3s ease",
                  }}
                >
                  💰 Calculate SIP on Total Interest
                  <div
                    style={{
                      fontSize: "12px",
                      fontWeight: "400",
                      marginTop: "4px",
                      opacity: "0.9",
                    }}
                  >
                    {formatCurrency(summary.totalInterest)}
                  </div>
                </button>
              </div>

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
                            <div
                              style={{ color: "#2563eb", fontWeight: "600" }}
                            >
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
                style={{
                  fontSize: "1rem",
                  marginBottom: "12px",
                  fontWeight: "600",
                }}
              >
                Lumpsum Prepayments
              </h3>

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr 60px",
                  gap: "12px",
                  marginBottom: "16px",
                  fontWeight: "700",
                  color: "#374151",
                  fontSize: "13px",
                }}
              >
                <span>Month</span>
                <span>Amount</span>
                <span></span>
              </div>

              {prepayments.map((prepay, index) => (
                <div
                  key={index}
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr 1fr 60px",
                    gap: "12px",
                    marginBottom: "12px",
                  }}
                >
                  <input
                    type="number"
                    value={prepay.month}
                    onChange={(e) => {
                      const newPrepayments = [...prepayments];
                      newPrepayments[index].month =
                        parseInt(e.target.value) || 0;
                      setPrepayments(newPrepayments);
                    }}
                    style={{
                      padding: "10px 14px",
                      border: "2px solid #e5e7eb",
                      borderRadius: "10px",
                      fontSize: "14px",
                      outline: "none",
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
                    style={{
                      padding: "10px 14px",
                      border: "2px solid #e5e7eb",
                      borderRadius: "10px",
                      fontSize: "14px",
                      outline: "none",
                    }}
                  />
                  <button
                    onClick={() => removePrepayment(index)}
                    style={{
                      border: "none",
                      borderRadius: "10px",
                      cursor: "pointer",
                      fontWeight: "700",
                      fontSize: "16px",
                      background: "linear-gradient(135deg, #ef4444, #dc2626)",
                      color: "white",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    X
                  </button>
                </div>
              ))}

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr 60px",
                  gap: "12px",
                  marginBottom: "12px",
                }}
              >
                <input
                  type="number"
                  value={newPrepayMonth}
                  onChange={(e) => setNewPrepayMonth(e.target.value)}
                  placeholder="Month"
                  style={{
                    padding: "10px 14px",
                    border: "2px solid #e5e7eb",
                    borderRadius: "10px",
                    fontSize: "14px",
                    outline: "none",
                  }}
                />
                <input
                  type="number"
                  value={newPrepayAmount}
                  onChange={(e) => setNewPrepayAmount(e.target.value)}
                  placeholder="Amount"
                  style={{
                    padding: "10px 14px",
                    border: "2px solid #e5e7eb",
                    borderRadius: "10px",
                    fontSize: "14px",
                    outline: "none",
                  }}
                />
                <button
                  onClick={addPrepayment}
                  style={{
                    border: "none",
                    borderRadius: "10px",
                    cursor: "pointer",
                    fontWeight: "700",
                    fontSize: "16px",
                    background: "linear-gradient(135deg, #10b981, #059669)",
                    color: "white",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  +
                </button>
              </div>
            </div>
          </div>

          {/* Summary Section */}
          <div
            style={{
              background: "rgba(255, 255, 255, 0.95)",
              backdropFilter: "blur(15px)",
              padding: "40px",
              borderRadius: "20px",
              marginBottom: "40px",
              border: "1px solid rgba(226, 232, 240, 0.5)",
              boxShadow: "0 12px 40px rgba(0, 0, 0, 0.1)",
              position: "relative",
              overflow: "hidden",
            }}
          >
            <div
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                right: 0,
                height: "4px",
                background: "linear-gradient(90deg, #f59e0b, #ef4444, #10b981)",
                borderRadius: "20px 20px 0 0",
              }}
            ></div>

            <h2
              style={{
                background: "linear-gradient(135deg, #1e40af, #7c3aed)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
                backgroundClip: "text",
                fontSize: "1.4rem",
                fontWeight: "700",
                marginBottom: "24px",
              }}
            >
              Summary
            </h2>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
                gap: "20px",
              }}
            >
              <div
                style={{
                  background: "rgba(255, 255, 255, 0.9)",
                  backdropFilter: "blur(10px)",
                  padding: "20px",
                  borderRadius: "16px",
                  boxShadow: "0 6px 24px rgba(0, 0, 0, 0.08)",
                  border: "1px solid rgba(255, 255, 255, 0.2)",
                  position: "relative",
                  overflow: "hidden",
                }}
              >
                <div
                  style={{
                    content: '""',
                    position: "absolute",
                    top: 0,
                    left: 0,
                    right: 0,
                    height: "3px",
                    background: "linear-gradient(90deg, #1e40af, transparent)",
                    opacity: 0.3,
                  }}
                ></div>
                <div
                  style={{
                    fontSize: "13px",
                    color: "#6b7280",
                    marginBottom: "8px",
                    fontWeight: "600",
                    textTransform: "uppercase",
                    letterSpacing: "0.05em",
                  }}
                >
                  {rateType === "floating" ? "Average EMI" : "Monthly EMI"}
                </div>
                <div
                  style={{
                    fontSize: "1.4rem",
                    fontWeight: "800",
                    color: "#1e40af",
                    letterSpacing: "-0.01em",
                  }}
                >
                  {formatCurrency(summary.emi)}
                </div>
              </div>

              <div
                style={{
                  background: "rgba(255, 255, 255, 0.9)",
                  backdropFilter: "blur(10px)",
                  padding: "20px",
                  borderRadius: "16px",
                  boxShadow: "0 6px 24px rgba(0, 0, 0, 0.08)",
                  border: "1px solid rgba(255, 255, 255, 0.2)",
                  position: "relative",
                  overflow: "hidden",
                }}
              >
                <div
                  style={{
                    content: '""',
                    position: "absolute",
                    top: 0,
                    left: 0,
                    right: 0,
                    height: "3px",
                    background: "linear-gradient(90deg, #7c3aed, transparent)",
                    opacity: 0.3,
                  }}
                ></div>
                <div
                  style={{
                    fontSize: "13px",
                    color: "#6b7280",
                    marginBottom: "8px",
                    fontWeight: "600",
                    textTransform: "uppercase",
                    letterSpacing: "0.05em",
                  }}
                >
                  Monthly Extra
                </div>
                <div
                  style={{
                    fontSize: "1.4rem",
                    fontWeight: "800",
                    color: "#7c3aed",
                    letterSpacing: "-0.01em",
                  }}
                >
                  {formatCurrency(monthlyExtraPayment)}
                </div>
              </div>

              <div
                style={{
                  background: "rgba(255, 255, 255, 0.9)",
                  backdropFilter: "blur(10px)",
                  padding: "20px",
                  borderRadius: "16px",
                  boxShadow: "0 6px 24px rgba(0, 0, 0, 0.08)",
                  border: "1px solid rgba(255, 255, 255, 0.2)",
                  position: "relative",
                  overflow: "hidden",
                }}
              >
                <div
                  style={{
                    content: '""',
                    position: "absolute",
                    top: 0,
                    left: 0,
                    right: 0,
                    height: "3px",
                    background: "linear-gradient(90deg, #dc2626, transparent)",
                    opacity: 0.3,
                  }}
                ></div>
                <div
                  style={{
                    fontSize: "13px",
                    color: "#6b7280",
                    marginBottom: "8px",
                    fontWeight: "600",
                    textTransform: "uppercase",
                    letterSpacing: "0.05em",
                  }}
                >
                  Total Interest
                </div>
                <div
                  style={{
                    fontSize: "1.4rem",
                    fontWeight: "800",
                    color: "#dc2626",
                    letterSpacing: "-0.01em",
                  }}
                >
                  {formatCurrency(summary.totalInterest)}
                </div>
              </div>

              <div
                style={{
                  background: "rgba(255, 255, 255, 0.9)",
                  backdropFilter: "blur(10px)",
                  padding: "20px",
                  borderRadius: "16px",
                  boxShadow: "0 6px 24px rgba(0, 0, 0, 0.08)",
                  border: "1px solid rgba(255, 255, 255, 0.2)",
                  position: "relative",
                  overflow: "hidden",
                }}
              >
                <div
                  style={{
                    content: '""',
                    position: "absolute",
                    top: 0,
                    left: 0,
                    right: 0,
                    height: "3px",
                    background: "linear-gradient(90deg, #059669, transparent)",
                    opacity: 0.3,
                  }}
                ></div>
                <div
                  style={{
                    fontSize: "13px",
                    color: "#6b7280",
                    marginBottom: "8px",
                    fontWeight: "600",
                    textTransform: "uppercase",
                    letterSpacing: "0.05em",
                  }}
                >
                  Interest Saved
                </div>
                <div
                  style={{
                    fontSize: "1.4rem",
                    fontWeight: "800",
                    color: "#059669",
                    letterSpacing: "-0.01em",
                  }}
                >
                  {formatCurrency(summary.interestSaved)}
                </div>
              </div>

              <div
                style={{
                  background: "rgba(255, 255, 255, 0.9)",
                  backdropFilter: "blur(10px)",
                  padding: "20px",
                  borderRadius: "16px",
                  boxShadow: "0 6px 24px rgba(0, 0, 0, 0.08)",
                  border: "1px solid rgba(255, 255, 255, 0.2)",
                  position: "relative",
                  overflow: "hidden",
                }}
              >
                <div
                  style={{
                    content: '""',
                    position: "absolute",
                    top: 0,
                    left: 0,
                    right: 0,
                    height: "3px",
                    background: "linear-gradient(90deg, #7c3aed, transparent)",
                    opacity: 0.3,
                  }}
                ></div>
                <div
                  style={{
                    fontSize: "13px",
                    color: "#6b7280",
                    marginBottom: "8px",
                    fontWeight: "600",
                    textTransform: "uppercase",
                    letterSpacing: "0.05em",
                  }}
                >
                  Loan Period
                </div>
                <div
                  style={{
                    fontSize: "1.4rem",
                    fontWeight: "800",
                    color: "#7c3aed",
                    letterSpacing: "-0.01em",
                  }}
                >
                  {formatMonthsToYearsMonths(summary.monthsCompleted)}
                </div>
              </div>

              <div
                style={{
                  background: "rgba(255, 255, 255, 0.9)",
                  backdropFilter: "blur(10px)",
                  padding: "20px",
                  borderRadius: "16px",
                  boxShadow: "0 6px 24px rgba(0, 0, 0, 0.08)",
                  border: "1px solid rgba(255, 255, 255, 0.2)",
                  position: "relative",
                  overflow: "hidden",
                }}
              >
                <div
                  style={{
                    content: '""',
                    position: "absolute",
                    top: 0,
                    left: 0,
                    right: 0,
                    height: "3px",
                    background: "linear-gradient(90deg, #059669, transparent)",
                    opacity: 0.3,
                  }}
                ></div>
                <div
                  style={{
                    fontSize: "13px",
                    color: "#6b7280",
                    marginBottom: "8px",
                    fontWeight: "600",
                    textTransform: "uppercase",
                    letterSpacing: "0.05em",
                  }}
                >
                  Months Saved
                </div>
                <div
                  style={{
                    fontSize: "1.4rem",
                    fontWeight: "800",
                    color: "#059669",
                    letterSpacing: "-0.01em",
                  }}
                >
                  {formatMonthsToYearsMonths(summary.monthsSaved)}
                </div>
              </div>

              {rateType === "floating" && (
                <div
                  style={{
                    background: "rgba(255, 255, 255, 0.9)",
                    backdropFilter: "blur(10px)",
                    padding: "20px",
                    borderRadius: "16px",
                    boxShadow: "0 6px 24px rgba(0, 0, 0, 0.08)",
                    border: "1px solid rgba(255, 255, 255, 0.2)",
                    position: "relative",
                    overflow: "hidden",
                  }}
                >
                  <div
                    style={{
                      content: '""',
                      position: "absolute",
                      top: 0,
                      left: 0,
                      right: 0,
                      height: "3px",
                      background:
                        "linear-gradient(90deg, #7c3aed, transparent)",
                      opacity: 0.3,
                    }}
                  ></div>
                  <div
                    style={{
                      fontSize: "13px",
                      color: "#6b7280",
                      marginBottom: "8px",
                      fontWeight: "600",
                      textTransform: "uppercase",
                      letterSpacing: "0.05em",
                    }}
                  >
                    Rate Changes
                  </div>
                  <div
                    style={{
                      fontSize: "1.4rem",
                      fontWeight: "800",
                      color: "#7c3aed",
                      letterSpacing: "-0.01em",
                    }}
                  >
                    {summary.rateChanges || 0}
                  </div>
                </div>
              )}

              <div
                style={{
                  background: "rgba(255, 255, 255, 0.9)",
                  backdropFilter: "blur(10px)",
                  padding: "20px",
                  borderRadius: "16px",
                  boxShadow: "0 6px 24px rgba(0, 0, 0, 0.08)",
                  border: "1px solid rgba(255, 255, 255, 0.2)",
                  position: "relative",
                  overflow: "hidden",
                }}
              >
                <div
                  style={{
                    content: '""',
                    position: "absolute",
                    top: 0,
                    left: 0,
                    right: 0,
                    height: "3px",
                    background: "linear-gradient(90deg, #7c3aed, transparent)",
                    opacity: 0.3,
                  }}
                ></div>
                <div
                  style={{
                    fontSize: "13px",
                    color: "#6b7280",
                    marginBottom: "8px",
                    fontWeight: "600",
                    textTransform: "uppercase",
                    letterSpacing: "0.05em",
                  }}
                >
                  Total Amount payable
                </div>
                <div
                  style={{
                    fontSize: "1.4rem",
                    fontWeight: "800",
                    color: "#7c3aed",
                    letterSpacing: "-0.01em",
                  }}
                >
                  {formatCurrency(summary.totalPayable)}
                </div>
              </div>
            </div>
          </div>

          {/* Charts */}
          <div style={{ marginBottom: "40px" }}>
            <h2
              style={{
                background: "linear-gradient(135deg, #1e40af, #7c3aed)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
                backgroundClip: "text",
                fontSize: "1.4rem",
                fontWeight: "700",
                marginBottom: "24px",
              }}
            >
              Payment Breakdown
            </h2>
            <div
              style={{
                background: "rgba(255, 255, 255, 0.95)",
                backdropFilter: "blur(15px)",
                padding: "32px",
                borderRadius: "20px",
                boxShadow: "0 12px 40px rgba(0, 0, 0, 0.1)",
                border: "1px solid rgba(226, 232, 240, 0.5)",
              }}
            >
              <ResponsiveContainer width="100%" height={300}>
                <BarChart
                  data={chartData}
                  margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
                >
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="month" />
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

          <div style={{ marginBottom: "40px" }}>
            <h2
              style={{
                background: "linear-gradient(135deg, #1e40af, #7c3aed)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
                backgroundClip: "text",
                fontSize: "1.4rem",
                fontWeight: "700",
                marginBottom: "24px",
              }}
            >
              Outstanding Balance
            </h2>
            <div
              style={{
                background: "rgba(255, 255, 255, 0.95)",
                backdropFilter: "blur(15px)",
                padding: "32px",
                borderRadius: "20px",
                boxShadow: "0 12px 40px rgba(0, 0, 0, 0.1)",
                border: "1px solid rgba(226, 232, 240, 0.5)",
              }}
            >
              <ResponsiveContainer width="100%" height={300}>
                <LineChart
                  data={chartData}
                  margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
                >
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis
                    dataKey="month"
                    label={{
                      value: "Month",
                      position: "insideBottom",
                      offset: -5,
                    }}
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

          <div style={{ marginBottom: "40px" }}>
            <h2
              style={{
                background: "linear-gradient(135deg, #1e40af, #7c3aed)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
                backgroundClip: "text",
                fontSize: "1.4rem",
                fontWeight: "700",
                marginBottom: "24px",
              }}
            >
              Amortization Schedule
            </h2>

            <div
              style={{
                background: "rgba(255, 255, 255, 0.95)",
                backdropFilter: "blur(15px)",
                borderRadius: "20px",
                overflow: "hidden",
                boxShadow: "0 12px 40px rgba(0, 0, 0, 0.1)",
                border: "1px solid rgba(226, 232, 240, 0.5)",
                overflowX: "auto",
              }}
            >
              <table
                style={{
                  width: "100%",
                  borderCollapse: "collapse",
                  fontSize: "14px",
                }}
              >
                <thead>
                  <tr>
                    <th
                      style={{
                        background: "linear-gradient(135deg, #dbeafe, #bfdbfe)",
                        padding: "16px 12px",
                        textAlign: "left",
                        fontWeight: "700",
                        color: "#1e40af",
                        fontSize: "12px",
                        textTransform: "uppercase",
                        letterSpacing: "0.05em",
                        borderBottom: "2px solid #3b82f6",
                        position: "sticky",
                        top: 0,
                        zIndex: 10,
                      }}
                    >
                      Month
                    </th>
                    {rateType === "floating" && (
                      <th
                        style={{
                          background:
                            "linear-gradient(135deg, #dbeafe, #bfdbfe)",
                          padding: "16px 12px",
                          textAlign: "left",
                          fontWeight: "700",
                          color: "#1e40af",
                          fontSize: "12px",
                          textTransform: "uppercase",
                          letterSpacing: "0.05em",
                          borderBottom: "2px solid #3b82f6",
                          position: "sticky",
                          top: 0,
                          zIndex: 10,
                        }}
                      >
                        Rate %
                      </th>
                    )}
                    <th
                      style={{
                        background: "linear-gradient(135deg, #dbeafe, #bfdbfe)",
                        padding: "16px 12px",
                        textAlign: "left",
                        fontWeight: "700",
                        color: "#1e40af",
                        fontSize: "12px",
                        textTransform: "uppercase",
                        letterSpacing: "0.05em",
                        borderBottom: "2px solid #3b82f6",
                        position: "sticky",
                        top: 0,
                        zIndex: 10,
                      }}
                    >
                      EMI
                    </th>
                    <th
                      style={{
                        background: "linear-gradient(135deg, #dbeafe, #bfdbfe)",
                        padding: "16px 12px",
                        textAlign: "left",
                        fontWeight: "700",
                        color: "#1e40af",
                        fontSize: "12px",
                        textTransform: "uppercase",
                        letterSpacing: "0.05em",
                        borderBottom: "2px solid #3b82f6",
                        position: "sticky",
                        top: 0,
                        zIndex: 10,
                      }}
                    >
                      Principal
                    </th>
                    <th
                      style={{
                        background: "linear-gradient(135deg, #dbeafe, #bfdbfe)",
                        padding: "16px 12px",
                        textAlign: "left",
                        fontWeight: "700",
                        color: "#1e40af",
                        fontSize: "12px",
                        textTransform: "uppercase",
                        letterSpacing: "0.05em",
                        borderBottom: "2px solid #3b82f6",
                        position: "sticky",
                        top: 0,
                        zIndex: 10,
                      }}
                    >
                      Interest
                    </th>
                    <th
                      style={{
                        background: "linear-gradient(135deg, #dbeafe, #bfdbfe)",
                        padding: "16px 12px",
                        textAlign: "left",
                        fontWeight: "700",
                        color: "#1e40af",
                        fontSize: "12px",
                        textTransform: "uppercase",
                        letterSpacing: "0.05em",
                        borderBottom: "2px solid #3b82f6",
                        position: "sticky",
                        top: 0,
                        zIndex: 10,
                      }}
                    >
                      Monthly Extra
                    </th>
                    <th
                      style={{
                        background: "linear-gradient(135deg, #dbeafe, #bfdbfe)",
                        padding: "16px 12px",
                        textAlign: "left",
                        fontWeight: "700",
                        color: "#1e40af",
                        fontSize: "12px",
                        textTransform: "uppercase",
                        letterSpacing: "0.05em",
                        borderBottom: "2px solid #3b82f6",
                        position: "sticky",
                        top: 0,
                        zIndex: 10,
                      }}
                    >
                      Lumpsum
                    </th>
                    <th
                      style={{
                        background: "linear-gradient(135deg, #dbeafe, #bfdbfe)",
                        padding: "16px 12px",
                        textAlign: "left",
                        fontWeight: "700",
                        color: "#1e40af",
                        fontSize: "12px",
                        textTransform: "uppercase",
                        letterSpacing: "0.05em",
                        borderBottom: "2px solid #3b82f6",
                        position: "sticky",
                        top: 0,
                        zIndex: 10,
                      }}
                    >
                      Balance
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {schedule.map((row, index) => (
                    <tr
                      key={index}
                      style={{
                        borderBottom: "1px solid #f1f5f9",
                        background:
                          row.lumpsumPrepayment > 0 || row.extraPayment > 0
                            ? "linear-gradient(135deg, #f0fdf4, #ecfdf5)"
                            : row.rateChanged
                            ? "linear-gradient(135deg, #fef3c7, #fde68a)"
                            : "transparent",
                        borderLeft:
                          row.lumpsumPrepayment > 0 || row.extraPayment > 0
                            ? "4px solid #10b981"
                            : row.rateChanged
                            ? "4px solid #f59e0b"
                            : "none",
                      }}
                    >
                      <td style={{ padding: "12px", color: "#111827" }}>
                        {row.month}
                      </td>
                      {rateType === "floating" && (
                        <td
                          style={{
                            padding: "12px",
                            color: row.rateChanged ? "#f59e0b" : "#111827",
                            fontWeight: row.rateChanged ? "700" : "400",
                          }}
                        >
                          {row.rate
                            ? `${row.rate.toFixed(2)}%`
                            : `${interestRate.toFixed(2)}%`}
                        </td>
                      )}
                      <td style={{ padding: "12px", color: "#111827" }}>
                        {formatCurrency(row.emi)}
                      </td>
                      <td style={{ padding: "12px", color: "#111827" }}>
                        {formatCurrency(row.principal)}
                      </td>
                      <td style={{ padding: "12px", color: "#111827" }}>
                        {formatCurrency(row.interest)}
                      </td>
                      <td
                        style={{
                          padding: "12px",
                          fontWeight: "700",
                          color: "#7c3aed",
                          textShadow: "0 1px 2px rgba(124, 58, 237, 0.1)",
                        }}
                      >
                        {formatCurrency(row.extraPayment)}
                      </td>
                      <td
                        style={{
                          padding: "12px",
                          fontWeight: "700",
                          color: "#059669",
                          textShadow: "0 1px 2px rgba(5, 150, 105, 0.1)",
                        }}
                      >
                        {formatCurrency(row.lumpsumPrepayment)}
                      </td>
                      <td style={{ padding: "12px", color: "#111827" }}>
                        {formatCurrency(row.balance)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* SIP Alternative Tab */}
      {activeTab === "sip" && (
        <div>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: "40px",
              marginBottom: "40px",
            }}
          >
            {/* SIP Input Section */}
            <div
              style={{
                background: "rgba(255, 255, 255, 0.9)",
                backdropFilter: "blur(10px)",
                padding: "32px",
                borderRadius: "16px",
                border: "1px solid rgba(226, 232, 240, 0.5)",
                boxShadow: "0 8px 32px rgba(0, 0, 0, 0.1)",
                position: "relative",
                overflow: "hidden",
              }}
            >
              <div
                style={{
                  position: "absolute",
                  top: 0,
                  left: 0,
                  right: 0,
                  height: "4px",
                  background:
                    "linear-gradient(90deg, #10b981, #059669, #047857)",
                  borderRadius: "16px 16px 0 0",
                }}
              ></div>

              <h2
                style={{
                  background: "linear-gradient(135deg, #059669, #047857)",
                  WebkitBackgroundClip: "text",
                  WebkitTextFillColor: "transparent",
                  backgroundClip: "text",
                  fontSize: "1.4rem",
                  fontWeight: "700",
                  marginBottom: "24px",
                }}
              >
                SIP Investment Parameters
              </h2>

              <div style={{ marginBottom: "20px" }}>
                <label
                  style={{
                    display: "block",
                    marginBottom: "8px",
                    fontWeight: "600",
                    color: "#374151",
                    fontSize: "14px",
                  }}
                >
                  SIP Target Amount
                </label>
                <input
                  type="number"
                  value={sipTarget}
                  onChange={(e) =>
                    setSipTarget(parseFloat(e.target.value) || 0)
                  }
                  style={{
                    width: "100%",
                    padding: "12px 16px",
                    border: "2px solid #e5e7eb",
                    borderRadius: "12px",
                    fontSize: "16px",
                    background: "rgba(255, 255, 255, 0.8)",
                    outline: "none",
                  }}
                />
                {sipTarget > 0 && (
                  <div
                    style={{
                      fontSize: "12px",
                      color: "#6b7280",
                      marginTop: "4px",
                      fontStyle: "italic",
                    }}
                  >
                    Target to accumulate: {formatCurrency(sipTarget)}
                  </div>
                )}
              </div>

              <div style={{ marginBottom: "20px" }}>
                <label
                  style={{
                    display: "block",
                    marginBottom: "8px",
                    fontWeight: "600",
                    color: "#374151",
                    fontSize: "14px",
                  }}
                >
                  Monthly SIP Amount
                </label>
                <input
                  type="number"
                  value={sipAmount}
                  onChange={(e) =>
                    setSipAmount(parseFloat(e.target.value) || 0)
                  }
                  style={{
                    width: "100%",
                    padding: "12px 16px",
                    border: "2px solid #e5e7eb",
                    borderRadius: "12px",
                    fontSize: "16px",
                    background: "rgba(255, 255, 255, 0.8)",
                    outline: "none",
                  }}
                />
                {sipAmount > 0 && (
                  <div
                    style={{
                      fontSize: "12px",
                      color: "#6b7280",
                      marginTop: "4px",
                      fontStyle: "italic",
                    }}
                  >
                    Monthly investment: {formatCurrency(sipAmount)}
                  </div>
                )}
              </div>

              <div style={{ marginBottom: "20px" }}>
                <label
                  style={{
                    display: "block",
                    marginBottom: "8px",
                    fontWeight: "600",
                    color: "#374151",
                    fontSize: "14px",
                  }}
                >
                  Time Period (months)
                </label>
                <input
                  type="number"
                  value={sipPeriod}
                  onChange={(e) => setSipPeriod(parseInt(e.target.value) || 0)}
                  style={{
                    width: "100%",
                    padding: "12px 16px",
                    border: "2px solid #e5e7eb",
                    borderRadius: "12px",
                    fontSize: "16px",
                    background: "rgba(255, 255, 255, 0.8)",
                    outline: "none",
                  }}
                />
                {sipPeriod > 0 && (
                  <div
                    style={{
                      fontSize: "12px",
                      color: "#6b7280",
                      marginTop: "4px",
                      fontStyle: "italic",
                    }}
                  >
                    {formatMonthsToYearsMonths(sipPeriod)}
                  </div>
                )}
              </div>

              <div style={{ marginBottom: "20px" }}>
                <label
                  style={{
                    display: "block",
                    marginBottom: "8px",
                    fontWeight: "600",
                    color: "#374151",
                    fontSize: "14px",
                  }}
                >
                  Expected SIP Return Rate (%)
                </label>
                <input
                  type="number"
                  value={sipReturnRate}
                  onChange={(e) =>
                    setSipReturnRate(parseFloat(e.target.value) || 0)
                  }
                  step="0.01"
                  style={{
                    width: "100%",
                    padding: "12px 16px",
                    border: "2px solid #e5e7eb",
                    borderRadius: "12px",
                    fontSize: "16px",
                    background: "rgba(255, 255, 255, 0.8)",
                    outline: "none",
                  }}
                />
              </div>

              <div
                style={{
                  background: "linear-gradient(135deg, #f0fdf4, #ecfdf5)",
                  padding: "16px",
                  borderRadius: "12px",
                  border: "1px solid #10b981",
                  marginTop: "24px",
                }}
              >
                <h4
                  style={{
                    color: "#059669",
                    marginBottom: "8px",
                    fontSize: "14px",
                    fontWeight: "600",
                  }}
                >
                  💡 How it works
                </h4>
                <p
                  style={{
                    fontSize: "13px",
                    color: "#047857",
                    lineHeight: "1.4",
                    margin: 0,
                  }}
                >
                  Set your monthly SIP amount and expected return rate to see
                  how your investment grows over time. Use the buttons in Loan
                  Management to automatically calculate optimal SIP amounts
                  based on loan costs.
                </p>
              </div>
            </div>

            {/* SIP Results */}
            <div
              style={{
                background: "rgba(255, 255, 255, 0.9)",
                backdropFilter: "blur(10px)",
                padding: "32px",
                borderRadius: "16px",
                border: "1px solid rgba(226, 232, 240, 0.5)",
                boxShadow: "0 8px 32px rgba(0, 0, 0, 0.1)",
                position: "relative",
                overflow: "hidden",
              }}
            >
              <div
                style={{
                  position: "absolute",
                  top: 0,
                  left: 0,
                  right: 0,
                  height: "4px",
                  background:
                    "linear-gradient(90deg, #10b981, #059669, #047857)",
                  borderRadius: "16px 16px 0 0",
                }}
              ></div>

              <h2
                style={{
                  background: "linear-gradient(135deg, #059669, #047857)",
                  WebkitBackgroundClip: "text",
                  WebkitTextFillColor: "transparent",
                  backgroundClip: "text",
                  fontSize: "1.4rem",
                  fontWeight: "700",
                  marginBottom: "8px",
                }}
              >
                SIP Results
              </h2>

              {sipCalculation.calculationType &&
                sipCalculation.targetAmount > 0 && (
                  <div
                    style={{
                      background:
                        sipCalculation.calculationType === "total"
                          ? "linear-gradient(135deg, #dbeafe, #bfdbfe)"
                          : "linear-gradient(135deg, #dcfce7, #bbf7d0)",
                      padding: "12px",
                      borderRadius: "8px",
                      marginBottom: "20px",
                      border: `1px solid ${
                        sipCalculation.calculationType === "total"
                          ? "#3b82f6"
                          : "#10b981"
                      }`,
                    }}
                  >
                    <div
                      style={{
                        fontSize: "13px",
                        fontWeight: "600",
                        color:
                          sipCalculation.calculationType === "total"
                            ? "#1e40af"
                            : "#059669",
                      }}
                    >
                      🎯 Calculating SIP for:{" "}
                      {sipCalculation.calculationType === "total"
                        ? "Total Amount Payable"
                        : "Total Interest Only"}
                    </div>
                    <div
                      style={{
                        fontSize: "16px",
                        fontWeight: "800",
                        color:
                          sipCalculation.calculationType === "total"
                            ? "#1e40af"
                            : "#059669",
                        marginTop: "4px",
                      }}
                    >
                      Target: {formatCurrency(sipCalculation.targetAmount)}
                    </div>
                  </div>
                )}

              {sipTarget > 0 && (
                <div style={{ marginBottom: "16px" }}>
                  <div
                    style={{
                      fontSize: "13px",
                      color: "#6b7280",
                      marginBottom: "4px",
                      fontWeight: "600",
                    }}
                  >
                    SIP Target Amount
                  </div>
                  <div
                    style={{
                      fontSize: "1.2rem",
                      fontWeight: "800",
                      color: "#7c3aed",
                    }}
                  >
                    {formatCurrency(sipTarget)}
                  </div>
                </div>
              )}

              <div style={{ marginBottom: "16px" }}>
                <div
                  style={{
                    fontSize: "13px",
                    color: "#6b7280",
                    marginBottom: "4px",
                    fontWeight: "600",
                  }}
                >
                  Required Monthly SIP
                </div>
                <div
                  style={{
                    fontSize: "1.2rem",
                    fontWeight: "800",
                    color: "#3b82f6",
                  }}
                >
                  {formatCurrency(sipCalculation.requiredSip)}
                </div>
                {sipAmount !== sipCalculation.requiredSip && sipAmount > 0 && (
                  <div
                    style={{
                      fontSize: "11px",
                      color: "#7c3aed",
                      marginTop: "2px",
                      fontStyle: "italic",
                    }}
                  >
                    You've set: {formatCurrency(sipAmount)}
                  </div>
                )}
              </div>

              <div style={{ marginBottom: "16px" }}>
                <div
                  style={{
                    fontSize: "13px",
                    color: "#6b7280",
                    marginBottom: "4px",
                    fontWeight: "600",
                  }}
                >
                  Total SIP Investment
                </div>
                <div
                  style={{
                    fontSize: "1.2rem",
                    fontWeight: "800",
                    color: "#7c3aed",
                  }}
                >
                  {formatCurrency(sipCalculation.totalSipInvestment)}
                </div>
              </div>

              <div style={{ marginBottom: "16px" }}>
                <div
                  style={{
                    fontSize: "13px",
                    color: "#6b7280",
                    marginBottom: "4px",
                    fontWeight: "600",
                  }}
                >
                  SIP Returns
                </div>
                <div
                  style={{
                    fontSize: "1.2rem",
                    fontWeight: "800",
                    color: "#059669",
                  }}
                >
                  {formatCurrency(sipCalculation.sipReturns)}
                </div>
              </div>

              <div
                style={{
                  background: "linear-gradient(135deg, #f0fdf4, #ecfdf5)",
                  padding: "16px",
                  borderRadius: "12px",
                  border: "2px solid #10b981",
                  marginTop: "20px",
                }}
              >
                <div
                  style={{
                    fontSize: "13px",
                    color: "#047857",
                    marginBottom: "4px",
                    fontWeight: "600",
                  }}
                >
                  💰 Net Wealth Created
                </div>
                <div
                  style={{
                    fontSize: "1.4rem",
                    fontWeight: "800",
                    color: "#059669",
                  }}
                >
                  {formatCurrency(sipCalculation.netBenefit)}
                </div>
                <div
                  style={{
                    fontSize: "12px",
                    color: "#047857",
                    marginTop: "4px",
                    fontStyle: "italic",
                  }}
                >
                  {sipCalculation.calculationType === "total" &&
                  sipCalculation.targetAmount > 0
                    ? "This is the wealth you create instead of paying the total loan amount"
                    : sipCalculation.calculationType === "interest" &&
                      sipCalculation.targetAmount > 0
                    ? "This is the wealth you create instead of paying interest"
                    : "This is your projected wealth creation from the SIP investment"}
                </div>
              </div>
            </div>
          </div>

          {/* Comparison Charts */}
          <div style={{ marginBottom: "40px" }}>
            <h2
              style={{
                background: "linear-gradient(135deg, #059669, #047857)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
                backgroundClip: "text",
                fontSize: "1.4rem",
                fontWeight: "700",
                marginBottom: "24px",
              }}
            >
              {sipCalculation.calculationType === "total" &&
              sipCalculation.targetAmount > 0
                ? "Total Loan Cost vs SIP Comparison"
                : sipCalculation.calculationType === "interest" &&
                  sipCalculation.targetAmount > 0
                ? "Interest vs SIP Comparison"
                : "SIP Investment Analysis"}
            </h2>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: "32px",
              }}
            >
              {/* Pie Chart */}
              <div
                style={{
                  background: "rgba(255, 255, 255, 0.95)",
                  backdropFilter: "blur(15px)",
                  padding: "32px",
                  borderRadius: "20px",
                  boxShadow: "0 12px 40px rgba(0, 0, 0, 0.1)",
                  border: "1px solid rgba(226, 232, 240, 0.5)",
                }}
              >
                <h3
                  style={{
                    textAlign: "center",
                    marginBottom: "20px",
                    fontSize: "1.1rem",
                    fontWeight: "600",
                  }}
                >
                  {sipCalculation.calculationType === "total" &&
                  sipCalculation.targetAmount > 0
                    ? "Loan Total vs SIP Returns"
                    : sipCalculation.calculationType === "interest" &&
                      sipCalculation.targetAmount > 0
                    ? "Loan Interest vs SIP Returns"
                    : "SIP Investment vs Returns"}
                </h3>
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={comparisonData}
                      cx="50%"
                      cy="50%"
                      outerRadius={80}
                      dataKey="value"
                      label={({ name, value }) =>
                        `${name}: ${formatCurrency(value)}`
                      }
                    >
                      {comparisonData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value) => formatCurrency(value)} />
                  </PieChart>
                </ResponsiveContainer>
              </div>

              {/* SIP Growth Chart */}
              <div
                style={{
                  background: "rgba(255, 255, 255, 0.95)",
                  backdropFilter: "blur(15px)",
                  padding: "32px",
                  borderRadius: "20px",
                  boxShadow: "0 12px 40px rgba(0, 0, 0, 0.1)",
                  border: "1px solid rgba(226, 232, 240, 0.5)",
                }}
              >
                <h3
                  style={{
                    textAlign: "center",
                    marginBottom: "20px",
                    fontSize: "1.1rem",
                    fontWeight: "600",
                  }}
                >
                  SIP Growth Over Time
                </h3>
                <ResponsiveContainer width="100%" height={300}>
                  <ComposedChart data={sipCalculation.sipSchedule}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="month" />
                    <YAxis />
                    <Tooltip formatter={(value) => formatCurrency(value)} />
                    <Legend />
                    <Area
                      type="monotone"
                      dataKey="cumulativeInvestment"
                      stackId="1"
                      stroke="#7c3aed"
                      fill="#a78bfa"
                      name="Investment"
                    />
                    <Area
                      type="monotone"
                      dataKey="growth"
                      stackId="1"
                      stroke="#10b981"
                      fill="#34d399"
                      name="Growth"
                    />
                    <Line
                      type="monotone"
                      dataKey="cumulativeReturns"
                      stroke="#059669"
                      strokeWidth={3}
                      name="Total Value"
                    />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          {/* SIP Schedule Table */}
          <div
            style={{
              background: "rgba(255, 255, 255, 0.95)",
              backdropFilter: "blur(15px)",
              borderRadius: "20px",
              overflow: "hidden",
              boxShadow: "0 12px 40px rgba(0, 0, 0, 0.1)",
              border: "1px solid rgba(226, 232, 240, 0.5)",
              marginBottom: "40px",
            }}
          >
            <div style={{ padding: "32px 32px 0 32px" }}>
              <h2
                style={{
                  background: "linear-gradient(135deg, #059669, #047857)",
                  WebkitBackgroundClip: "text",
                  WebkitTextFillColor: "transparent",
                  backgroundClip: "text",
                  fontSize: "1.4rem",
                  fontWeight: "700",
                  marginBottom: "24px",
                }}
              >
                SIP Investment Schedule
              </h2>
            </div>

            <div style={{ overflowX: "auto" }}>
              <table
                style={{
                  width: "100%",
                  borderCollapse: "collapse",
                  fontSize: "14px",
                }}
              >
                <thead>
                  <tr
                    style={{
                      background: "linear-gradient(135deg, #dcfce7, #bbf7d0)",
                    }}
                  >
                    <th
                      style={{
                        padding: "16px 12px",
                        textAlign: "left",
                        fontWeight: "700",
                        color: "#059669",
                        fontSize: "12px",
                        textTransform: "uppercase",
                        borderBottom: "2px solid #10b981",
                      }}
                    >
                      Month
                    </th>
                    <th
                      style={{
                        padding: "16px 12px",
                        textAlign: "left",
                        fontWeight: "700",
                        color: "#059669",
                        fontSize: "12px",
                        textTransform: "uppercase",
                        borderBottom: "2px solid #10b981",
                      }}
                    >
                      SIP Amount
                    </th>
                    <th
                      style={{
                        padding: "16px 12px",
                        textAlign: "left",
                        fontWeight: "700",
                        color: "#059669",
                        fontSize: "12px",
                        textTransform: "uppercase",
                        borderBottom: "2px solid #10b981",
                      }}
                    >
                      Total Invested
                    </th>
                    <th
                      style={{
                        padding: "16px 12px",
                        textAlign: "left",
                        fontWeight: "700",
                        color: "#059669",
                        fontSize: "12px",
                        textTransform: "uppercase",
                        borderBottom: "2px solid #10b981",
                      }}
                    >
                      Total Value
                    </th>
                    <th
                      style={{
                        padding: "16px 12px",
                        textAlign: "left",
                        fontWeight: "700",
                        color: "#059669",
                        fontSize: "12px",
                        textTransform: "uppercase",
                        borderBottom: "2px solid #10b981",
                      }}
                    >
                      Growth
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {sipCalculation.sipSchedule.slice(0, 24).map((row, index) => (
                    <tr
                      key={index}
                      style={{ borderBottom: "1px solid #f1f5f9" }}
                    >
                      <td style={{ padding: "12px", color: "#111827" }}>
                        {row.month}
                      </td>
                      <td
                        style={{
                          padding: "12px",
                          color: "#111827",
                          fontWeight: "600",
                        }}
                      >
                        {formatCurrency(row.sipAmount)}
                      </td>
                      <td
                        style={{
                          padding: "12px",
                          color: "#7c3aed",
                          fontWeight: "600",
                        }}
                      >
                        {formatCurrency(row.cumulativeInvestment)}
                      </td>
                      <td
                        style={{
                          padding: "12px",
                          color: "#059669",
                          fontWeight: "700",
                        }}
                      >
                        {formatCurrency(row.cumulativeReturns)}
                      </td>
                      <td
                        style={{
                          padding: "12px",
                          color: "#10b981",
                          fontWeight: "600",
                        }}
                      >
                        {formatCurrency(row.growth)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {sipCalculation.sipSchedule.length > 24 && (
              <div
                style={{
                  padding: "16px 32px",
                  textAlign: "center",
                  fontSize: "14px",
                  color: "#6b7280",
                  fontStyle: "italic",
                }}
              >
                Showing first 24 months. Total period: {sipPeriod} months
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default EnhancedCalculator;
