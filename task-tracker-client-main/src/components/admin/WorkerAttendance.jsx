import React, { Fragment, useContext, useEffect, useState } from 'react'
import { FaChevronLeft, FaMoneyBillWave } from 'react-icons/fa';
import { Link, useParams } from 'react-router-dom'
import Button from '../common/Button';
import appContext from '../../context/AppContext';
import { toast } from 'react-toastify';
import { getAttendance } from '../../services/attendanceService';
import Table from '../common/Table';
import TaskSpinner from '../common/Spinner';
import { GrPowerReset } from "react-icons/gr";
import { calculateWorkerProductivity } from '../../utils/productivityCalculator';
import ProductivityDisplay from './ProductivityDisplay';
import api from '../../hooks/useAxios';
import { getAuthToken } from '../../utils/authUtils';
import jsPDF from 'jspdf';

const WorkerAttendance = () => {
    const { id } = useParams();
    const [rawAttendanceData, setRawAttendanceData] = useState([]);
    const { subdomain } = useContext(appContext);
    const [isLoading, setIsLoading] = useState(true);
    const [fromDate, setFromDate] = useState('');
    const [toDate, setToDate] = useState('');
    const [fiteredBatch, setFilteredBatch] = useState('');
    const [processedAttendanceData, setProcessedAttendanceData] = useState([]);
    const [productivityData, setProductivityData] = useState(null);
    const [settingsData, setSettingsData] = useState(null);
    const [isGenerating, setIsGenerating] = useState(false);
    const [loading, setLoading] = useState(true);

    // Process attendance data to group by date and include department
    const processAttendanceData = (data) => {
        const groupedData = {};

        data.forEach(record => {
            const date = record.date ? record.date.split('T')[0] : 'Unknown';
            if (!groupedData[date]) {
                groupedData[date] = {
                    date,
                    name: record.worker?.name || 'Unknown',
                    rfid: record.worker?.rfid || 'Unknown',
                    departmentName: getDepartmentName(record),
                    photo: record.worker?.photo,
                    inTimes: [],
                    outTimes: [],
                    createdAt: record.createdAt
                };
            }

            if (record.presence) {
                groupedData[date].inTimes.push(record.time);
            } else {
                groupedData[date].outTimes.push(record.time);
            }
        });

        return Object.values(groupedData).sort((a, b) => 
            new Date(b.date) - new Date(a.date)
        );
    };

    // Helper function to get department name from various possible locations
    const getDepartmentName = (record) => {
        return record.worker?.department?.name || 
               record.department?.name || 
               record.worker?.departmentName || 
               record.departmentName || 
               'Unknown';
    };

    const fetchSettings = async () => {
        if (!subdomain || subdomain === 'main') {
            toast.error('Invalid subdomain. Please check the URL.');
            setLoading(false);
            return;
        }

        setLoading(true);
        try {
            const token = getAuthToken();
            const response = await api.get(`/settings/${subdomain}`, {
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`
                }
            });
            const fetchedSettings = response.data;
            setSettingsData(fetchedSettings);
            setFilteredBatch(fetchedSettings.batches?.[0]?.batchName || '');
        } catch (error) {
            console.error('Error fetching settings!', error);
            toast.error('Failed to fetch settings');
        } finally {
            setLoading(false);
        }
    };

    const fetchAttendanceData = async () => {
        setIsLoading(true);
        try {
            const data = await getAttendance({ subdomain });
            const filteredData = Array.isArray(data.attendance)
                ? data.attendance.filter(item => item.worker?._id === id)
                : [];
            
            setRawAttendanceData(filteredData);
            setProcessedAttendanceData(processAttendanceData(filteredData));
        } catch (error) {
            console.error(error);
            toast.error("Failed to fetch attendance data.");
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        if (subdomain && subdomain !== 'main') {
            fetchSettings();
            fetchAttendanceData();
        }
    }, [subdomain]);

    useEffect(() => {
        let filtered = processedAttendanceData;

        // Filter by date range
        if (fromDate || toDate) {
            filtered = filtered.filter(item => {
                if (!item.date) return false;
                if (fromDate && toDate) {
                    return item.date >= fromDate && item.date <= toDate;
                }
                else if (fromDate) {
                    return item.date >= fromDate;
                }
                else if (toDate) {
                    return item.date <= toDate;
                }
                return true;
            });
        }

        // Calculate productivity if date range is set
        if (fromDate && toDate && settingsData) {
            const productivityParameters = {
                attendanceData: rawAttendanceData.filter(item => {
                    const itemDate = item.date ? item.date.split('T')[0] : '';
                    return itemDate >= fromDate && itemDate <= toDate;
                }),
                fromDate,
                toDate,
                options: {
                    considerOvertime: settingsData.considerOvertime,
                    deductSalary: settingsData.deductSalary,
                    permissionTimeMinutes: settingsData.permissionTimeMinutes,
                    salaryDeductionPerBreak: settingsData.salaryDeductionPerBreak,
                    batches: settingsData.batches,
                    lunchFrom: settingsData.lunchFrom,
                    lunchTo: settingsData.lunchTo,
                    isLunchConsider: settingsData.isLunchConsider,
                    intervals: settingsData.intervals,
                    fiteredBatch: fiteredBatch
                }
            };
            const productivity = calculateWorkerProductivity(productivityParameters);
            setProductivityData(productivity);
        } else {
            setProductivityData(null);
        }
    }, [fromDate, toDate, processedAttendanceData, settingsData, fiteredBatch, rawAttendanceData]);

    const handleReset = () => {
        setProcessedAttendanceData(processAttendanceData(rawAttendanceData));
        setFromDate('');
        setToDate('');
        setProductivityData(null);
    };

    const handleFromDateChange = (e) => {
        const newFromDate = e.target.value;
        if (toDate && newFromDate > toDate) {
            toast.error("From date cannot be greater than To date");
            return;
        }
        setFromDate(newFromDate);
    };

    const handleToDateChange = (e) => {
        const newToDate = e.target.value;
        if (fromDate && newToDate < fromDate) {
            toast.error("To date cannot be less than From date");
            return;
        }
        setToDate(newToDate);
    };

    const handleBatchChange = (e) => {
        setFilteredBatch(e.target.value);
    };

    const downloadPDF = async (reportData) => {
        setIsGenerating(true);
        try {
            const doc = new jsPDF();
            
            // Header
            doc.setFontSize(20);
            doc.text('Employee Attendance Report', 20, 20);
            
            // Worker Info
            doc.setFontSize(12);
            doc.text(`Name: ${reportData.summary.worker.name}`, 20, 40);
            doc.text(`Employee ID: ${reportData.summary.worker.rfid}`, 20, 50);
            
            // Summary
            doc.setFontSize(14);
            doc.text('Summary', 20, 70);
            doc.setFontSize(10);
            let y = 80;
            Object.entries(reportData.finalSummary).forEach(([key, value]) => {
                doc.text(`${key}: ${value}`, 20, y);
                y += 10;
            });
            
            // Attendance Details
            doc.setFontSize(14);
            doc.text('Daily Attendance', 20, y + 10);
            y += 20;
            doc.setFontSize(10);
            
            // Table headers
            doc.text('Date', 20, y);
            doc.text('IN Times', 60, y);
            doc.text('OUT Times', 120, y);
            y += 10;
            
            // Table rows
            processedAttendanceData
                .filter(item => {
                    if (!fromDate && !toDate) return true;
                    if (fromDate && toDate) return item.date >= fromDate && item.date <= toDate;
                    if (fromDate) return item.date >= fromDate;
                    if (toDate) return item.date <= toDate;
                    return true;
                })
                .forEach(record => {
                    doc.text(record.date, 20, y);
                    doc.text(record.inTimes.join(', '), 60, y);
                    doc.text(record.outTimes.join(', '), 120, y);
                    y += 10;
                });
            
            doc.save(`attendance_report_${new Date().toISOString().split('T')[0]}.pdf`);
            toast.success('PDF generated successfully!');
        } catch (error) {
            console.error('Error generating PDF:', error);
            toast.error('Error generating PDF. Please try again.');
        } finally {
            setIsGenerating(false);
        }
    };

    const columns = [
        {
            header: 'Name',
            accessor: 'name',
            render: (record) => (
                <div className="flex items-center">
                    {record.photo && (
                        <img
                            src={record.photo || `https://ui-avatars.com/api/?name=${encodeURIComponent(record.name)}`}
                            alt="Employee"
                            className="w-8 h-8 rounded-full mr-2"
                        />
                    )}
                    {record.name || 'Unknown'}
                </div>
            )
        },
        {
            header: 'Employee ID',
            accessor: 'rfid',
            render: (record) => record.rfid || 'Unknown'
        },
        {
            header: 'Department',
            accessor: 'departmentName',
            render: (record) => (
                <span className="font-medium">
                    {record.departmentName}
                </span>
            )
        },
        {
            header: 'Date',
            accessor: 'date',
            render: (record) => record.date || 'Unknown'
        },
        {
            header: 'IN Times',
            accessor: 'inTimes',
            render: (record) => (
                <div className="text-green-600">
                    {record.inTimes.map((time, index) => (
                        <div key={index}>{time}</div>
                    ))}
                </div>
            )
        },
        {
            header: 'OUT Times',
            accessor: 'outTimes',
            render: (record) => (
                <div className="text-red-600">
                    {record.outTimes.map((time, index) => (
                        <div key={index}>{time}</div>
                    ))}
                </div>
            )
        }
    ];

    return (
        <Fragment>
            <div className="flex justify-between items-center mb-6 mt-4">
                <h1 className="text-2xl font-bold">Attendance Report</h1>
                <div className="flex justify-end space-x-4 items-center mb-6">
                    <Link to={'/admin/attendance'}>
                        <Button variant="primary" className="flex items-center">
                            <FaChevronLeft className="mr-2" />Back
                        </Button>
                    </Link>
                </div>
            </div>

            <div className="flex justify-end space-x-4 items-center mb-6">
                {settingsData?.batches && (
                    <div className="flex items-center space-x-2">
                        <label className="text-sm font-medium text-gray-700">Batch:</label>
                        <select
                            value={fiteredBatch}
                            onChange={handleBatchChange}
                            className="form-input w-40 bg-white text-gray-700"
                        >
                            {settingsData.batches.map((batch) => (
                                <option key={batch.id} value={batch.batchName}>
                                    {batch.batchName}
                                </option>
                            ))}
                        </select>
                    </div>
                )}

                <div className="flex items-center space-x-2">
                    <label className="text-sm font-medium text-gray-700">From:</label>
                    <input
                        type="date"
                        className="form-input w-40"
                        value={fromDate}
                        onChange={handleFromDateChange}
                    />
                </div>
                <div className="flex items-center space-x-2">
                    <label className="text-sm font-medium text-gray-700">To:</label>
                    <input
                        type="date"
                        className="form-input w-40"
                        value={toDate}
                        onChange={handleToDateChange}
                    />
                </div>

                {productivityData && (
                    <Button
                        variant="success"
                        className="flex items-center"
                        onClick={() => downloadPDF({
                            finalSummary: productivityData.finalSummary,
                            report: productivityData.report,
                            summary: productivityData.summary
                        })}
                        disabled={isGenerating}
                    >
                        <FaMoneyBillWave className="mr-2" />
                        {isGenerating ? 'Generating...' : 'Download PDF'}
                    </Button>
                )}

                <Button
                    variant="primary"
                    className="flex items-center"
                    onClick={handleReset}
                >
                    <GrPowerReset className="mr-2" />Reset
                </Button>
            </div>

            {(fromDate || toDate) && (
                <div className="mb-4 p-3 bg-blue-50 rounded-lg border border-blue-200">
                    <p className="text-sm text-blue-800">
                        <strong>Filtered Period:</strong>
                        {fromDate && toDate ? ` ${fromDate} to ${toDate}` :
                            fromDate ? ` From ${fromDate} onwards` :
                                ` Up to ${toDate}`}
                    </p>
                </div>
            )}

            {productivityData && (
                <ProductivityDisplay productivityData={productivityData} />
            )}

            {isLoading ? (
                <div className="flex justify-center py-8">
                    <TaskSpinner size="md" variant="default" />
                </div>
            ) : (
                <Table
                    columns={columns}
                    data={processedAttendanceData.filter(item => {
                        if (!fromDate && !toDate) return true;
                        if (fromDate && toDate) return item.date >= fromDate && item.date <= toDate;
                        if (fromDate) return item.date >= fromDate;
                        if (toDate) return item.date <= toDate;
                        return true;
                    })}
                    noDataMessage="No attendance records found for the selected date range."
                />
            )}
        </Fragment>
    );
};

export default WorkerAttendance;